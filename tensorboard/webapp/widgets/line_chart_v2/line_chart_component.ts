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
    <svg #svg></svg>
    <canvas #canvas></canvas>
    <line-chart-interactive-layer
      [data]="data"
      [visibleSeries]="visibleSeries"
      [colorMap]="colorMap"
      [chartLayout]="chartLayout"
      [viewExtent]="viewExtent"
      [xScale]="xScale"
      [yScale]="yScale"
      (onViewExtentChange)="onViewExtentChanged($event)"
      (onViewExtentReset)="onViewExtentReset()"
    ></line-chart-interactive-layer>
  `,
  styles: [
    `
      :host {
        position: relative;
      }

      :host,
      svg,
      canvas {
        height: 100%;
        width: 100%;
      }

      :host[chart-type='svg'] canvas {
        display: none;
      }

      :host:not([chart-type='svg']) svg {
        display: none;
      }

      line-chart-interactive-layer {
        position: absolute;
        top: 0;
        left: 0;
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

  readonly ChartType = RendererType;

  @HostBinding('attr.chart-type')
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
          this.lineChart.resize({
            x: 0,
            y: 0,
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
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

      const domRect = {
        x: 0,
        y: 0,
        width: this.hostElRef.nativeElement.clientWidth,
        height: this.hostElRef.nativeElement.clientHeight,
      };

      let params: LayerOption | null = null;
      switch (this.rendererType) {
        case RendererType.SVG:
          params = {
            type: RendererType.SVG,
            container: this.svg.nativeElement,
            callbacks,
            domRect,
          };
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
        [
          {
            type: ViewType.COMPOSITE_LAYOUT,
            children: [
              {type: ViewType.GRID_VIEW, children: undefined},
              {type: ViewType.SERIES_LINE_VIEW, children: []},
            ],
          },
        ],
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
      x: this.xScale.niceDomain(...this.dataExtent.x),
      y: this.yScale.niceDomain(...this.dataExtent.y),
    };
  }
}
