import {XAxisView, YAxisView} from './axis_view';
import {Canvas3dRenderer, SvgRenderer} from './renderer';
import {IRenderer} from './renderer_types';
import {RootLayout} from './root_layout';
import {
  DataSeriesMetadataMap,
  DataSeries,
  DataExtent,
  LayerCallbacks,
  LayerOption,
  LayoutChildren,
  Rect,
  RendererType,
  ScaleType,
  VisibilityMap,
} from './types';
import {THREECoordinator, Coordinator} from './coordinator';
import {ILayer} from './layer_types';
import {createRootLayout} from './layout_util';
import {SeriesLineView} from './series_line_view';
import {Scale, createScale} from './scale';

export class Layer implements ILayer {
  private readonly renderer: IRenderer;
  private readonly root: RootLayout;
  private readonly coordinator: Coordinator;
  private readonly metadataMap: DataSeriesMetadataMap = {};
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

    this.setXScaleType(option.xScaleType);
    this.setYScaleType(option.yScaleType);

    const layoutConfig = {
      container: option.container,
      renderer: this.renderer,
      coordinator: this.coordinator,
      metadataMap: this.metadataMap,
    };

    this.root = createRootLayout(layouts, layoutConfig, option.domRect);

    this.resize(option.domRect);
  }

  setXScaleType(type: ScaleType) {
    this.coordinator.setXScale(createScale(type));
  }

  setYScaleType(type: ScaleType) {
    this.coordinator.setYScale(createScale(type));
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
    Object.entries(metadataMap).forEach(([id, metadata]) => {
      const existing = this.metadataMap[id];
      if (
        !existing ||
        metadata.color !== existing.color ||
        metadata.visible !== existing.visible ||
        metadata.opacity !== existing.opacity
      ) {
        shouldRepaint = true;
      }

      this.metadataMap[id] = metadata;
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

  updateData(data: DataSeries[]) {
    this.root.setData(data);
    this.scheduleRedraw();
  }

  private shouldRedraw = false;
  private scheduleRedraw() {
    if (!this.shouldRedraw) {
      this.shouldRedraw = true;
      requestAnimationFrame(() => {
        this.redraw();
        this.shouldRedraw = false;
      });
    }
  }

  private redraw() {
    this.root.redraw();
    this.renderer.render();
  }
}
