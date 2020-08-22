import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import {GridView, XAxisView, YAxisView} from './axis_view';
import {ColorProvider} from './color_provider';
import {Canvas2dRenderer, Canvas3dRenderer, SvgRenderer} from './renderer';
import {Renderer} from './renderer_types';
import {RootLayout} from './root_layout';
import {
  DataSeriesMetadataMap,
  DataSeries,
  Rect,
  DataExtent,
  VisibilityMap,
  ChartType,
  LineChartOption,
  ILineChart,
  LineChartCallbacks,
} from './types';
import {CompositeLayout} from './composite_layout';
import {THREECoordinator, Coordinator} from './coordinator';
import {FlexLayout} from './flex_layout';
import {SeriesLineView} from './series_line_view';

export class LineChart implements ILineChart {
  private readonly renderer: Renderer;
  private readonly root: RootLayout;
  private readonly coordinator: Coordinator;
  private readonly colorProivder = new ColorProvider();
  private readonly visibilityMap: VisibilityMap = new Map();

  controls?: OrbitControls;

  constructor(
    private readonly id: number,
    rect: Rect,
    option: LineChartOption,
    private readonly callbacks: LineChartCallbacks
  ) {
    switch (option.type) {
      case ChartType.SVG: {
        this.coordinator = new Coordinator();
        this.renderer = new SvgRenderer(option.container);
        break;
      }
      case ChartType.CANVAS: {
        this.coordinator = new Coordinator();
        this.renderer = new Canvas2dRenderer(
          option.container,
          option.devicePixelRatio
        );
        break;
      }
      case ChartType.WEBGL: {
        const coordinator = new THREECoordinator();
        this.coordinator = coordinator;
        this.renderer = new Canvas3dRenderer(
          option.container,
          coordinator,
          option.devicePixelRatio
        );

        if (typeof document !== 'undefined') {
          this.controls = new OrbitControls(coordinator.getCamera());
          this.controls.enableZoom = false;
          this.controls.update();
        }
        break;
      }
    }

    const contentAreaOption = {
      container: option.container,
      renderer: this.renderer,
      coordinator: this.coordinator,
      colorProvider: this.colorProivder,
      visibilityMap: this.visibilityMap,
    };

    this.root = new RootLayout(
      contentAreaOption,
      [
        [
          new YAxisView(contentAreaOption),
          new CompositeLayout(contentAreaOption, [
            new GridView(contentAreaOption),
            new SeriesLineView(contentAreaOption),
          ]),
        ],
        [new FlexLayout(contentAreaOption), new XAxisView(contentAreaOption)],
      ],
      rect
    );

    this.resize(rect);
    this.animate();
  }

  resize(rect: Rect) {
    this.coordinator.setDomContainerRect(rect);
    this.renderer.onResize(rect);
    this.root.onResize(rect);
    // If the DOM size changes, it is likely that we need to redraw.
    this.root.markAsPaintDirty();
    this.scheduleRedraw();
    this.notifyLayout();
  }

  private notifyLayout() {
    const lineView = this.root.findChildByClass(SeriesLineView);
    const yAxis = this.root.findChildByClass(YAxisView);
    const xAxis = this.root.findChildByClass(XAxisView);

    this.callbacks.onLayout({
      xAxis: xAxis!.getLayoutRect(),
      yAxis: yAxis!.getLayoutRect(),
      lines: lineView!.getLayoutRect(),
    });
  }

  updateMetadata(metadataMap: DataSeriesMetadataMap) {
    let shouldRepaint = false;
    Object.entries(metadataMap).forEach(([id, {color, visible}]) => {
      if (
        color !== this.colorProivder.getColor(id) ||
        this.visibilityMap.get(id) !== visible
      ) {
        shouldRepaint = true;
      }

      this.colorProivder.setColor(id, color);
      this.visibilityMap.set(id, visible);
    });
    if (shouldRepaint) {
      this.root.markAsPaintDirty();
    }
    this.scheduleRedraw();
  }

  updateViewbox(extent: DataExtent) {
    this.coordinator.setViewportRect({
      x: extent.x[0],
      width: extent.x[1] - extent.x[0],
      y: extent.y[0],
      height: extent.y[1] - extent.y[0],
    });
    // Force re-render
    this.root.markAsPaintDirty();
    this.scheduleRedraw();
  }

  updateData(data: DataSeries[], extent: DataExtent) {
    this.coordinator.setDataExtent(extent);
    this.root.setData(data);
    this.scheduleRedraw();
  }

  private shouldRedraw = false;
  private scheduleRedraw() {
    this.shouldRedraw = true;
  }

  private redraw() {
    this.root.redraw();
    this.renderer.render();
  }

  private animate() {
    requestAnimationFrame(() => {
      this.animate();

      if (this.shouldRedraw) {
        this.shouldRedraw = false;
        this.redraw();
      }

      if (this.controls) {
        this.controls.update();
      }

      this.renderer.render();
    });
  }
}
