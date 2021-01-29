/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import {ChartImpl} from './lib/chart';
import {Chart} from './lib/chart_types';
import {
  ChartCallbacks,
  ChartOptions,
  DataSeries,
  DataSeriesMetadataMap,
  Extent,
  Formatter,
  RendererType,
  Scale,
  ScaleType,
} from './lib/public_types';
import {createScale} from './lib/scale';
import {isOffscreenCanvasSupported} from './lib/utils';
import {WorkerChart} from './lib/worker/worker_chart';
import {
  computeDataSeriesExtent,
  getRendererType,
} from './line_chart_internal_utils';
import {TooltipTemplate} from './sub_view/line_chart_interactive_view';

export {TooltipTemplate} from './sub_view/line_chart_interactive_view';

const DEFAULT_EXTENT: Extent = {x: [0, 1], y: [0, 1]};

interface DomDimensions {
  main: {width: number; height: number};
  yAxis: {width: number; height: number};
  xAxis: {width: number; height: number};
}

@Component({
  selector: 'line-chart',
  templateUrl: 'line_chart_component.ng.html',
  styleUrls: ['line_chart_component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly RendererType = RendererType;

  @ViewChild('seriesView', {static: true, read: ElementRef})
  private seriesView!: ElementRef<HTMLElement>;

  @ViewChild('xAxis', {static: true, read: ElementRef})
  private xAxis!: ElementRef<HTMLElement>;

  @ViewChild('yAxis', {static: true, read: ElementRef})
  private yAxis!: ElementRef<HTMLElement>;

  @ViewChild('chartEl', {static: false, read: ElementRef})
  private chartEl?: ElementRef<HTMLCanvasElement | SVGElement>;

  @Input()
  preferredRendererType: RendererType = RendererType.WEBGL;

  @Input()
  seriesData!: DataSeries[];

  // In case of PR curve line chart, we do not want to compute the viewBox based on the
  // data.
  @Input()
  fixedViewBox?: Extent;

  @Input()
  seriesMetadataMap!: DataSeriesMetadataMap;

  @Input()
  xScaleType: ScaleType = ScaleType.LINEAR;

  @Input()
  yScaleType: ScaleType = ScaleType.LINEAR;

  @Input()
  customXFormatter?: Formatter;

  @Input()
  customYFormatter?: Formatter;

  @Input()
  tooltipTemplate?: TooltipTemplate;

  /**
   * Optional parameter to tweak whether to propagate update to line chart implementation.
   * When not specified, it defaults to `false`. When it is `true`, it remembers what has
   * changed and applies the change when the update is enabled.
   */
  @Input()
  disableUpdate?: boolean;

  /**
   * Whether to ignore outlier when computing default viewBox from the dataSeries.
   *
   * Do note that we only take values in between approxmiately 5th to 95th percentiles.
   */
  @Input()
  ignoreYOutliers: boolean = false;

  readonly Y_GRID_COUNT = 6;
  readonly X_GRID_COUNT = 10;

  xScale: Scale = createScale(this.xScaleType);
  yScale: Scale = createScale(this.xScaleType);
  viewBox: Extent = DEFAULT_EXTENT;

  domDimensions: DomDimensions = {
    main: {width: 0, height: 0},
    xAxis: {width: 0, height: 0},
    yAxis: {width: 0, height: 0},
  };

  private lineChart?: Chart;
  private isDataUpdated = false;
  private isMetadataUpdated = false;
  private isFixedViewBoxUpdated = false;
  private isViewBoxOverridden = false;
  // Must set the default view box since it is an optional input and won't trigger
  // onChanges.
  private isViewBoxChanged = true;
  private scaleUpdated = true;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    // OnChanges only decides whether props need to be updated and do not directly update
    // the line chart.

    if (changes['xScaleType']) {
      this.xScale = createScale(this.xScaleType);
      this.scaleUpdated = true;
    }

    if (changes['yScaleType']) {
      this.yScale = createScale(this.yScaleType);
      this.scaleUpdated = true;
    }

    if (changes['seriesData']) {
      this.isDataUpdated = true;
    }

    if (changes['fixedViewBox']) {
      this.isFixedViewBoxUpdated = true;
    }

    if (changes['seriesMetadataMap']) {
      this.isMetadataUpdated = true;
    }

    this.isViewBoxChanged =
      this.isViewBoxChanged ||
      (!this.isViewBoxOverridden && this.shouldUpdateDefaultViewBox(changes));

    this.updateLineChart();
  }

  ngAfterViewInit() {
    const dimPropChanged = this.readAndUpdateDomDimensions();
    this.initializeChart();
    const viewboxPropChanged = this.updateLineChart();

    // After view is initialized, if we ever change the Angular prop that should propagate
    // to children, we need to retrigger the Angular change. Since we lazily update the
    // property, these may return false.
    if (dimPropChanged || viewboxPropChanged) {
      this.changeDetector.detectChanges();
    }
  }

  onViewResize() {
    if (!this.lineChart) return;

    this.readAndUpdateDomDimensions();
    this.lineChart.resize(this.domDimensions.main);
    this.changeDetector.detectChanges();
  }

  /**
   * Returns true when default view box changes (e.g., due to more data coming in
   * or more series becoming visible).
   *
   * Calculating the dataExtent and updating the viewBox accordingly can be an expensive
   * operation.
   */
  private shouldUpdateDefaultViewBox(changes: SimpleChanges): boolean {
    if (
      changes['xScaleType'] ||
      changes['yScaleType'] ||
      changes['ignoreYOutliers']
    ) {
      return true;
    }

    const seriesDataChange = changes['seriesData'];
    if (seriesDataChange) {
      // Technically, this is much more convoluted; we should see if the seriesData that
      // change is visible and was visible so we do not recompute the extent when an
      // invisible data series change (that did not contribute to the dataExtent
      // calculation) causes extent computation. However, for now, since seriesData dirty
      // checking is expensive, too, we simply recompute the default box when seriesData
      // changes. When this proves to be a hot spot, we can improve the logic in this
      // method to detect dirtiness to minimize the work.
      return true;
    }

    const seriesMetadataChange = changes['seriesMetadataMap'];
    if (seriesMetadataChange) {
      const prevMetadataMap = seriesMetadataChange.previousValue;
      if (
        Object.keys(this.seriesMetadataMap).length !==
        Object.keys(prevMetadataMap ?? {}).length
      ) {
        return true;
      }

      for (const [id, metadata] of Object.entries(this.seriesMetadataMap)) {
        const prevMetadata = prevMetadataMap && prevMetadataMap[id];
        if (!prevMetadata || metadata.visible !== prevMetadata.visible) {
          return true;
        }
      }
    }

    return false;
  }

  private initializeChart() {
    if (this.lineChart) {
      throw new Error('LineChart should not be initialized multiple times.');
    }

    const rendererType = this.getRendererType();
    // Do not yet need to subscribe to the `onDrawEnd`.
    const callbacks: ChartCallbacks = {onDrawEnd: () => {}};
    let params: ChartOptions | null = null;

    switch (rendererType) {
      case RendererType.SVG: {
        params = {
          type: RendererType.SVG,
          container: this.chartEl!.nativeElement as SVGElement,
          callbacks,
          domDimension: this.domDimensions.main,
        };
        break;
      }
      case RendererType.WEBGL:
        params = {
          type: RendererType.WEBGL,
          container: this.chartEl!.nativeElement as HTMLCanvasElement,
          devicePixelRatio: window.devicePixelRatio,
          callbacks,
          domDimension: this.domDimensions.main,
        };
        break;
      default:
        const neverRendererType = rendererType as never;
        throw new Error(
          `<line-chart> does not yet support rendererType: ${neverRendererType}`
        );
    }

    const useWorker =
      rendererType !== RendererType.SVG && isOffscreenCanvasSupported();
    const klass = useWorker ? WorkerChart : ChartImpl;
    this.lineChart = new klass(params);
  }

  ngOnDestroy() {
    if (this.lineChart) this.lineChart.dispose();
  }

  getRendererType(): RendererType {
    return getRendererType(this.preferredRendererType);
  }

  private readAndUpdateDomDimensions(): boolean {
    const prevDomDimension = this.domDimensions;
    this.domDimensions = {
      main: {
        width: this.seriesView.nativeElement.clientWidth,
        height: this.seriesView.nativeElement.clientHeight,
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

    return (
      prevDomDimension.main.width !== this.domDimensions.main.width ||
      prevDomDimension.main.height !== this.domDimensions.main.height ||
      prevDomDimension.xAxis.width !== this.domDimensions.xAxis.width ||
      prevDomDimension.xAxis.height !== this.domDimensions.xAxis.height ||
      prevDomDimension.yAxis.width !== this.domDimensions.yAxis.width ||
      prevDomDimension.yAxis.height !== this.domDimensions.yAxis.height
    );
  }

  /**
   * Minimally and imperatively updates the chart library depending on prop changed.
   */
  private updateLineChart(): boolean {
    if (!this.lineChart || this.disableUpdate) return false;
    let ngStateUpdated = false;

    if (this.scaleUpdated) {
      this.scaleUpdated = false;
      this.lineChart.setXScaleType(this.xScaleType);
      this.lineChart.setYScaleType(this.yScaleType);
    }

    if (this.isMetadataUpdated) {
      this.isMetadataUpdated = false;
      this.lineChart.setMetadata(this.seriesMetadataMap);
    }

    if (this.isDataUpdated) {
      this.isDataUpdated = false;
      this.lineChart.setData(this.seriesData);
    }

    if (this.isFixedViewBoxUpdated && this.fixedViewBox) {
      this.viewBox = this.fixedViewBox;
    } else if (!this.isViewBoxOverridden && this.isViewBoxChanged) {
      const dataExtent = computeDataSeriesExtent(
        this.seriesData,
        this.seriesMetadataMap,
        this.ignoreYOutliers,
        this.xScale.isSafeNumber,
        this.yScale.isSafeNumber
      );
      this.viewBox = {
        x: this.xScale.niceDomain(dataExtent.x ?? DEFAULT_EXTENT.x),
        y: this.yScale.niceDomain(dataExtent.y ?? DEFAULT_EXTENT.y),
      };
      ngStateUpdated = true;
    }

    // There are below conditions in which the viewBox changes.
    const shouldSetViewBox =
      this.isFixedViewBoxUpdated || this.isViewBoxChanged;

    if (shouldSetViewBox) {
      this.isFixedViewBoxUpdated = false;
      this.isViewBoxChanged = false;
      this.lineChart.setViewBox(this.viewBox);
    }

    return ngStateUpdated;
  }

  onViewBoxChanged({dataExtent}: {dataExtent: Extent}) {
    this.isViewBoxOverridden = true;
    this.isViewBoxChanged = true;
    this.viewBox = dataExtent;
    this.updateLineChart();
  }

  viewBoxReset() {
    this.isViewBoxOverridden = false;
    this.isViewBoxChanged = true;
    this.updateLineChart();
  }
}
