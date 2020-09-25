import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  SimpleChanges,
  ViewChild,
  OnChanges,
  OnDestroy,
} from '@angular/core';

import {
  ChartExportedLayouts,
  RendererType,
  DataExtent,
  DataSeries,
  DataSeriesMetadataMap,
  LayerCallbacks,
  LayerOption,
  ViewExtent,
  ViewType,
  Rect,
} from './lib/types';
import {Layer} from './lib/layer';
import {WorkerLayer} from './lib/worker_layer';
import {LinearScale, Scale} from './lib/scale';
import {ILayer} from './lib/layer_types';

let instId = 0;

function calculateSeriesExtent(data: DataSeries[]): DataExtent {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const {points} of data) {
    for (let index = 0; index < points.length; index++) {
      xMin = Math.min(xMin, points[index].x);
      xMax = Math.max(xMax, points[index].x);
      yMin = Math.min(yMin, points[index].y);
      yMax = Math.max(yMax, points[index].y);
    }
  }

  return {x: [xMin, xMax], y: [yMin, yMax]};
}

export enum ScaleType {
  LINEAR,
}

interface ResizeObserverEntry {
  contentRect: DOMRectReadOnly;
}

@Component({
  selector: 'line-chart',
  template: `
    <div class="container">
      <div class="series-view">
        <line-chart-grid-view
          [viewExtent]="viewExtent"
          [xScale]="xScale"
          [yScale]="yScale"
          [xGridCount]="10"
          [yGridCount]="6"
        ></line-chart-grid-view>

        <svg #svg></svg>
        <canvas #canvas></canvas>
        <line-chart-interactive-layer
          [data]="data"
          [visibleSeries]="visibleSeries"
          [colorMap]="colorMap"
          [viewExtent]="viewExtent"
          [xScale]="xScale"
          [yScale]="yScale"
          [overlayRefContainer]="overlayAnchor"
          (onViewExtentChange)="onViewExtentChanged($event)"
          (onViewExtentReset)="onViewExtentReset()"
        ></line-chart-interactive-layer>
      </div>
      <line-chart-y-axis
        [viewExtent]="viewExtent"
        [yScale]="yScale"
        [yGridCount]="6"
      ></line-chart-y-axis>
      <line-chart-x-axis
        #overlayAnchor="cdkOverlayOrigin"
        cdkOverlayOrigin
        [viewExtent]="viewExtent"
        [xScale]="xScale"
        [xGridCount]="10"
      ></line-chart-x-axis>
    </div>
  `,
  styles: [
    `
      :host {
        height: 100%;
        width: 100%;
      }

      .container {
        background: #fff;
        display: grid;
        height: 100%;
        overflow: hidden;
        width: 100%;
        grid-template-areas:
          'yaxis series'
          '. xaxis';
        grid-template-columns: 50px 1fr;
        grid-auto-rows: 1fr 30px;
      }

      .series-view {
        grid-area: series;
        position: relative;
        overflow: hidden;
      }

      :host[renderer-type='svg'] canvas {
        display: none;
      }

      :host:not([renderer-type='svg']) svg {
        display: none;
      }

      canvas,
      svg,
      line-chart-grid-view,
      line-chart-interactive-layer {
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
      }

      line-chart-x-axis {
        grid-area: xaxis;
      }

      line-chart-y-axis {
        grid-area: yaxis;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements OnChanges, OnDestroy {
  @ViewChild('svg', {static: true, read: ElementRef})
  private readonly svg!: ElementRef<SVGElement>;

  @ViewChild('canvas', {static: true, read: ElementRef})
  private readonly canvas!: ElementRef<HTMLCanvasElement>;

  @HostBinding('attr.renderer-type')
  readonly rendererType: RendererType = RendererType.WEBGL;

  @Input()
  data!: DataSeries[];

  @Input()
  defaultViewExtent?: ViewExtent;

  @Input()
  visibleSeries!: Set<string>;

  @Input()
  colorMap!: Map<string, string>;

  @Input()
  useWorkerIfCanvas: boolean = false;

  @Input()
  xScaleType: ScaleType = ScaleType.LINEAR;

  @Input()
  yScaleType: ScaleType = ScaleType.LINEAR;

  readonly id = instId++;

  chartLayout: ChartExportedLayouts | null = null;

  xScale: Scale = new LinearScale();
  yScale: Scale = new LinearScale();
  viewExtent: ViewExtent = {
    x: [0, 1],
    y: [0, 1],
  };

  private lineChart?: ILayer;
  private dataExtent?: DataExtent;
  private isDataUpdated = false;
  private isMetadataUpdated = false;
  // Must set the default view extent since it is an optional input.
  private isViewExtentUpdated = true;

  private readonly resizeObserver: any;

  constructor(
    private readonly hostElRef: ElementRef,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.resizeObserver = new (window as any).ResizeObserver(
      (entries: ResizeObserverEntry[]) => {
        if (!this.lineChart) {
          return;
        }

        for (const entry of entries) {
          if (!entry.contentRect) {
            return;
          }
          this.lineChart.resize(this.getDomRect());
        }
      }
    );
    this.resizeObserver.observe(hostElRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.unobserve(this.hostElRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['xScaleType']) {
      switch (this.xScaleType) {
        case ScaleType.LINEAR:
          this.xScale = new LinearScale();
          break;
      }
    }
    if (changes['yScaleType']) {
      switch (this.yScaleType) {
        case ScaleType.LINEAR:
          this.yScale = new LinearScale();
          break;
      }
    }

    if (!this.lineChart) {
      const callbacks: LayerCallbacks = {
        onLayout: (layouts) => {
          this.chartLayout = layouts;
          this.changeDetector.detectChanges();
        },
      };

      let params: LayerOption | null = null;
      const domRect = this.getDomRect();
      switch (this.rendererType) {
        case RendererType.SVG:
          params = {
            type: RendererType.SVG,
            container: this.svg.nativeElement,
            callbacks,
            domRect,
          };
          this.svg.nativeElement;
          break;
        case RendererType.WEBGL:
          params = {
            type: RendererType.WEBGL,
            container: this.canvas.nativeElement,
            devicePixelRatio: window.devicePixelRatio,
            callbacks,
            domRect,
          };
          break;
        case RendererType.CANVAS:
          params = {
            type: RendererType.CANVAS,
            container: this.canvas.nativeElement,
            devicePixelRatio: window.devicePixelRatio,
            callbacks,

            domRect,
          };
          break;
      }

      if (!params) {
        return;
      }

      const klass = this.useWorkerIfCanvas ? WorkerLayer : Layer;
      this.lineChart = new klass(this.id, params, [
        [{type: ViewType.SERIES_LINE_VIEW, children: []}],
      ]);
    }

    if (changes['data']) {
      this.isDataUpdated = true;
      if (!this.viewExtent) {
        this.isViewExtentUpdated = true;
      }
    }

    if (changes['defaultViewExtent']) {
      this.isViewExtentUpdated = true;
    }

    if (changes['visibleSeries'] || changes['colorMap']) {
      this.isMetadataUpdated = true;
    }

    this.updateProp();
  }

  private getDomRect(): Rect {
    switch (this.rendererType) {
      case RendererType.SVG:
        return {
          x: 0,
          y: 0,
          width: this.svg.nativeElement.clientWidth,
          height: this.svg.nativeElement.clientHeight,
        };
      case RendererType.WEBGL:
      case RendererType.CANVAS:
        return {
          x: 0,
          y: 0,
          width: this.canvas.nativeElement.clientWidth,
          height: this.canvas.nativeElement.clientHeight,
        };
      default:
        throw new Error(`Unsupported rendererType: ${this.rendererType}`);
    }
  }

  private updateProp() {
    if (!this.lineChart) {
      return;
    }

    if (this.isDataUpdated) {
      this.isDataUpdated = false;
      this.dataExtent = calculateSeriesExtent(this.data);
      this.lineChart.updateData(this.data, this.dataExtent);
      this.viewExtent = this.getDefaultViewExtent() || this.viewExtent;
    }

    if (this.isViewExtentUpdated) {
      this.isViewExtentUpdated = false;
      const extent = this.viewExtent || this.getDefaultViewExtent();
      if (extent) {
        this.lineChart.updateViewbox(extent);
      }
    }

    if (this.isMetadataUpdated) {
      this.isMetadataUpdated = false;
      const metadata: DataSeriesMetadataMap = {};
      this.data.forEach(({name}) => {
        metadata[name] = {
          name,
          color: this.colorMap.get(name) || '#f00',
          visible: this.visibleSeries.has(name),
        };
      });
      this.lineChart.updateMetadata(metadata);
    }
  }

  onViewExtentChanged(viewExtent: ViewExtent) {
    this.isViewExtentUpdated = true;
    this.viewExtent = viewExtent;
    this.updateProp();
  }

  onViewExtentReset() {
    this.isViewExtentUpdated = true;
    const nextExtent = this.getDefaultViewExtent();
    if (nextExtent) {
      this.viewExtent = nextExtent;
    }
    this.updateProp();
  }

  private getDefaultViewExtent(): ViewExtent | null {
    if (this.defaultViewExtent) {
      return this.defaultViewExtent;
    }

    if (!this.dataExtent) {
      return null;
    }

    return {
      x: this.xScale.nice(this.dataExtent.x),
      y: this.yScale.nice(this.dataExtent.y),
    };
  }
}
