import {Coordinator} from './coordinator';
import {LayoutOption, LayoutRect} from './layout';
import {IRenderer} from './renderer_types';
import {
  DataInternalSeries,
  DataSeries,
  DataSeriesMetadataMap,
  VisibilityMap,
} from './types';

export interface DrawableConfig extends LayoutOption {
  coordinator: Coordinator;
  metadataMap: DataSeriesMetadataMap;
  renderer: IRenderer;
}

export abstract class Drawable extends LayoutRect {
  private paintDirty = true;

  protected readonly metadataMap: DataSeriesMetadataMap;
  protected readonly coordinator: Coordinator;
  protected readonly renderer: IRenderer;
  private coordinateIdentifier: number | null = null;

  constructor(config: DrawableConfig, contentGrid?: LayoutRect[][]) {
    super(config, contentGrid);
    this.metadataMap = config.metadataMap;
    this.coordinator = config.coordinator;
    this.renderer = config.renderer;
  }

  markAsPaintDirty() {
    this.paintDirty = true;
  }

  internalOnlyRedraw() {
    if (!this.paintDirty && !this.layoutChanged) {
      return;
    }

    this.renderer.renderGroup(this.constructor.name, () => {
      this.redraw();
    });

    this.paintDirty = false;
    this.layoutChanged = false;
  }

  protected isCoordinateUpdated() {
    return this.coordinator.getUpdateIdentifier() !== this.coordinateIdentifier;
  }

  protected updateCoordinateIdentifier() {
    this.coordinateIdentifier = this.coordinator.getUpdateIdentifier();
  }

  protected clearCoordinateIdentifier() {
    this.coordinateIdentifier = null;
  }

  markAsPaintDirtyIfCoordinateStale() {
    if (this.isCoordinateUpdated()) {
      this.markAsPaintDirty();
    }
  }

  abstract redraw(): void;
}

export abstract class DataDrawable extends Drawable {
  private rawSeriesData: DataSeries[] = [];
  // UI coordinate mapped data.
  protected series: DataInternalSeries[] = [];

  setData(data: DataSeries[]) {
    this.clearCoordinateIdentifier();
    this.rawSeriesData = data;
  }

  internalOnlyTransformCoordinatesIfStale(): void {
    if (!this.isCoordinateUpdated()) {
      return;
    }

    const layoutRect = this.getLayoutRect();
    this.series = new Array(this.rawSeriesData.length);

    for (let i = 0; i < this.rawSeriesData.length; i++) {
      const datum = this.rawSeriesData[i];
      this.series[i] = {
        id: datum.id,
        paths: new Float32Array(datum.points.length * 2),
      };
      for (let pointIndex = 0; pointIndex < datum.points.length; pointIndex++) {
        const [x, y] = this.coordinator.getViewCoordinate(layoutRect, [
          datum.points[pointIndex].x,
          datum.points[pointIndex].y,
        ]);
        this.series[i].paths[pointIndex * 2] = x;
        this.series[i].paths[pointIndex * 2 + 1] = y;
      }
    }

    this.updateCoordinateIdentifier();
    this.markAsPaintDirty();
  }
}
