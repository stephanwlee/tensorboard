import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  SimpleChanges,
  ViewChild,
  OnChanges,
  AfterViewInit,
} from '@angular/core';

import {
  ChartExportedLayouts,
  DataExtent,
  DataSeries,
  DataSeriesMetadataMap,
  LayerCallbacks,
  LayerOption,
  Rect,
  RendererType,
  ScaleType,
  ViewExtent,
  ViewType,
} from './lib/types';
import {Layer} from './lib/layer';
import {WorkerLayer} from './lib/worker_layer';
import {Scale, createScale} from './lib/scale';
import {ILayer} from './lib/layer_types';
import {isWebGl2Supported, isOffscreenCanvasSupported} from './lib/utils';

let instId = 0;

function calculateSeriesExtent(data: DataSeries[]): DataExtent {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  if (!data.length) {
    return {x: [0, 1], y: [0, 1]};
  }

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

interface DomDimensions {
  main: {width: number; height: number};
  yAxis: {width: number; height: number};
  xAxis: {width: number; height: number};
}

@Component({
  selector: 'line-chart',
  template: `
    <div
      class="container"
      detectResize
      (onResize)="onViewResize()"
      [resizeEventDebouncePeriodInMs]="0"
    >
      <div class="series-view" #main>
        <line-chart-grid-view
          [viewExtent]="viewExtent"
          [xScale]="xScale"
          [yScale]="yScale"
          [xGridCount]="10"
          [yGridCount]="6"
          [domDimensions]="domDimensions.main"
        ></line-chart-grid-view>
        <svg #chartEl *ngIf="getRendererType() === RendererType.SVG"></svg>
        <canvas
          #chartEl
          *ngIf="getRendererType() === RendererType.WEBGL"
        ></canvas>
        <line-chart-interactive-layer
          [seriesData]="seriesData"
          [seriesMetadataMap]="seriesMetadataMap"
          [viewExtent]="viewExtent"
          [xScale]="xScale"
          [yScale]="yScale"
          [overlayRefContainer]="xAxis"
          [domDimensions]="domDimensions.main"
          (onViewExtentChange)="onViewExtentChanged($event)"
          (onViewExtentReset)="onViewExtentReset()"
        ></line-chart-interactive-layer>
      </div>
      <line-chart-y-axis
        #yAxis
        [viewExtent]="viewExtent"
        [yScale]="yScale"
        [yGridCount]="6"
        [domDimensions]="domDimensions.yAxis"
      ></line-chart-y-axis>
      <line-chart-x-axis
        #xAxis="cdkOverlayOrigin"
        cdkOverlayOrigin
        [viewExtent]="viewExtent"
        [xScale]="xScale"
        [xGridCount]="10"
        [domDimensions]="domDimensions.xAxis"
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
export class LineChartComponent implements AfterViewInit, OnChanges {
  readonly RendererType = RendererType;

  @ViewChild('main', {static: true, read: ElementRef})
  private main!: ElementRef<HTMLElement>;

  @ViewChild('xAxis', {static: true, read: ElementRef})
  private xAxis!: ElementRef<HTMLElement>;

  @ViewChild('yAxis', {static: true, read: ElementRef})
  private yAxis!: ElementRef<HTMLElement>;

  @ViewChild('chartEl', {static: false, read: ElementRef})
  private chartEl?: ElementRef<HTMLCanvasElement | SVGElement>;

  @Input()
  readonly preferredRendererType: RendererType = isWebGl2Supported()
    ? RendererType.WEBGL
    : RendererType.SVG;

  @Input()
  seriesData!: DataSeries[];

  @Input()
  defaultViewExtent?: ViewExtent;

  @Input()
  seriesMetadataMap!: DataSeriesMetadataMap;

  @Input()
  forceUseWorkerIfCanvas: boolean = false;

  @Input()
  xScaleType: ScaleType = ScaleType.LINEAR;

  @Input()
  yScaleType: ScaleType = ScaleType.LINEAR;

  readonly id = instId++;

  chartLayout: ChartExportedLayouts | null = null;

  xScale: Scale = createScale(this.xScaleType);
  yScale: Scale = createScale(this.xScaleType);
  viewExtent: ViewExtent = {
    x: [0, 1],
    y: [0, 1],
  };

  domDimensions: DomDimensions = {
    main: {width: 0, height: 0},
    xAxis: {width: 0, height: 0},
    yAxis: {width: 0, height: 0},
  };

  private lineChart?: ILayer;
  private dataExtent?: DataExtent;
  private isDataUpdated = false;
  private isMetadataUpdated = false;
  // Must set the default view extent since it is an optional input.
  private isViewExtentUpdated = true;

  constructor(
    private readonly hostElRef: ElementRef,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['xScaleType']) {
      this.xScale = createScale(this.xScaleType);
    }

    if (changes['yScaleType']) {
      this.yScale = createScale(this.yScaleType);
    }

    if (changes['seriesData']) {
      this.isDataUpdated = true;
      // Changing the data points resets the viewExtent.
      this.isViewExtentUpdated = true;
    }

    if (changes['defaultViewExtent']) {
      this.isViewExtentUpdated = true;
    }

    if (changes['seriesMetadataMap']) {
      this.isMetadataUpdated = true;
    }

    this.updateProp();
  }

  ngAfterViewInit() {
    this.initializeChart();
    this.updateProp();
  }

  onViewResize() {
    if (!this.lineChart) {
      return;
    }

    this.updateDomDimensions();
    this.lineChart.resize({
      x: 0,
      y: 0,
      ...this.domDimensions.main,
    });
  }

  private initializeChart() {
    if (this.lineChart) {
      return;
    }

    const rendererType = this.getRendererType();
    const callbacks: LayerCallbacks = {
      onLayout: (layouts) => {
        this.chartLayout = layouts;
        this.changeDetector.detectChanges();
      },
    };

    let params: LayerOption | null = null;

    this.updateDomDimensions();
    const domRect = {
      x: 0,
      y: 0,
      ...this.domDimensions.main,
    };

    switch (rendererType) {
      case RendererType.SVG: {
        params = {
          type: RendererType.SVG,
          container: this.chartEl!.nativeElement as SVGElement,
          callbacks,
          domRect,
          xScaleType: this.xScaleType,
          yScaleType: this.yScaleType,
        };
        break;
      }
      case RendererType.WEBGL:
        params = {
          type: RendererType.WEBGL,
          container: this.chartEl!.nativeElement as HTMLCanvasElement,
          devicePixelRatio: window.devicePixelRatio,
          callbacks,
          domRect,
          xScaleType: this.xScaleType,
          yScaleType: this.yScaleType,
        };
        break;
    }

    if (!params) {
      return;
    }

    const useWorker =
      rendererType !== RendererType.SVG &&
      (this.forceUseWorkerIfCanvas || isOffscreenCanvasSupported());
    const klass = useWorker ? WorkerLayer : Layer;
    this.lineChart = new klass(this.id, params, [
      [{type: ViewType.SERIES_LINE_VIEW, children: []}],
    ]);
  }

  getRendererType(): RendererType {
    switch (this.preferredRendererType) {
      case RendererType.SVG:
        return RendererType.SVG;
      case RendererType.WEBGL:
        if (isWebGl2Supported()) {
          return RendererType.WEBGL;
        }
        return RendererType.SVG;
      default:
        throw new Error(
          `Invariant Error: Unknown rendererType: ${this.preferredRendererType}`
        );
    }
  }

  private updateDomDimensions(): void {
    this.domDimensions = {
      main: {
        width: this.main.nativeElement.clientWidth,
        height: this.main.nativeElement.clientHeight,
      },
      xAxis: {
        width: this.xAxis.nativeElement.clientWidth,
        height: this.xAxis.nativeElement.clientHeight,
      },
      yAxis: {
        width: this.yAxis.nativeElement.clientWidth,
        height: this.yAxis.nativeElement.clientHeight,
      },
    };
  }

  private updateProp() {
    if (!this.lineChart) {
      return;
    }

    if (this.isMetadataUpdated || this.isDataUpdated) {
      this.isMetadataUpdated = false;
      const metadata: DataSeriesMetadataMap = {};
      // Copy over only what is required.
      this.seriesData.forEach(({id}) => {
        metadata[id] = this.seriesMetadataMap[id];
      });
      this.lineChart.updateMetadata(metadata);
    }

    if (this.isDataUpdated) {
      this.isDataUpdated = false;
      this.dataExtent = calculateSeriesExtent(this.seriesData);
      this.lineChart.updateData(this.seriesData, this.dataExtent);
      this.viewExtent = this.getDefaultViewExtent() || this.viewExtent;
    }

    if (this.isViewExtentUpdated) {
      this.isViewExtentUpdated = false;
      const extent = this.viewExtent || this.getDefaultViewExtent();
      if (extent) {
        this.lineChart.updateViewbox(extent);
      }
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
