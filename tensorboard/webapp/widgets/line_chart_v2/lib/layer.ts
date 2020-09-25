import {XAxisView, YAxisView} from './axis_view';
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
  RendererType,
  LayerOption,
  LayerCallbacks,
  LayoutChildren,
} from './types';
import {ILayer} from './layer_types';
import {THREECoordinator, Coordinator} from './coordinator';
import {SeriesLineView} from './series_line_view';
import {createRootLayout} from './layout_util';

export class Layer implements ILayer {
  private readonly renderer: Renderer;
  private readonly root: RootLayout;
  private readonly coordinator: Coordinator;
  private readonly colorProivder = new ColorProvider();
  private readonly visibilityMap: VisibilityMap = new Map();
  private readonly callbacks: LayerCallbacks;

  constructor(
    private readonly id: number,
    option: LayerOption,
    layouts: LayoutChildren
  ) {
    this.callbacks = option.callbacks;

    switch (option.type) {
      case RendererType.SVG: {
        this.coordinator = new Coordinator();
        this.renderer = new SvgRenderer(option.container);
        break;
      }
      case RendererType.CANVAS: {
        this.coordinator = new Coordinator();
        this.renderer = new Canvas2dRenderer(
          option.container,
          option.devicePixelRatio
        );
        break;
      }
      case RendererType.WEBGL: {
        const coordinator = new THREECoordinator();
        this.coordinator = coordinator;
        this.renderer = new Canvas3dRenderer(
          option.container,
          coordinator,
          option.devicePixelRatio
        );
        break;
      }
    }

    const layoutConfig = {
      container: option.container,
      renderer: this.renderer,
      coordinator: this.coordinator,
      colorProvider: this.colorProivder,
      visibilityMap: this.visibilityMap,
    };

    this.root = createRootLayout(layouts, layoutConfig, option.domRect);

    this.resize(option.domRect);
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
      xAxis: xAxis?.getLayoutRect() ?? null,
      yAxis: yAxis?.getLayoutRect() ?? null,
      lines: lineView?.getLayoutRect() ?? null,
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
    // this.coordinator.setDataExtent(extent);
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

      this.renderer.render();
    });
  }
}
