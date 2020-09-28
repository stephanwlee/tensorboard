import {ColorProvider} from './color_provider';
import {Coordinator} from './coordinator';
import {LayoutOption, LayoutRect} from './layout';
import {Renderer} from './renderer_types';
import {DataInternalSeries, DataSeries, VisibilityMap} from './types';

export interface DrawableConfig extends LayoutOption {
  colorProvider: ColorProvider;
  renderer: Renderer;
  visibilityMap: VisibilityMap;
  coordinator: Coordinator;
}

export abstract class Drawable extends LayoutRect {
  private paintDirty = true;

  protected readonly colorProvider: ColorProvider;
  protected readonly coordinator: Coordinator;
  protected readonly renderer: Renderer;
  protected readonly visibilityMap: VisibilityMap;
  private coordinateIdentifier: number | null = null;

  constructor(config: DrawableConfig, contentGrid?: LayoutRect[][]) {
    super(config, contentGrid);
    this.colorProvider = config.colorProvider;
    this.coordinator = config.coordinator;
    this.renderer = config.renderer;
    this.visibilityMap = config.visibilityMap;
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
    this.rawSeriesData = data;
  }

  async internalOnlyTransformCoordinatesIfStale(): Promise<void> {
    if (!this.isCoordinateUpdated()) {
      return;
    }

    const layoutRect = this.getLayoutRect();
    this.series = new Array(this.rawSeriesData.length);

    console.time('before');
    for (let i = 0; i < this.rawSeriesData.length; i++) {
      const datum = this.rawSeriesData[i];
      this.series[i] = {
        name: datum.name,
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
    console.timeEnd('before');

    console.time('after');
    let seriesCount = 0;
    for (let i = 0; i < this.rawSeriesData.length; i++) {
      const datum = this.rawSeriesData[i];
      // Pre-allocate the data structure
      this.series[i] = {
        name: datum.name,
        paths: new Float32Array(datum.points.length * 2),
      };
      // Remember the length of all points so we can batch convert the coordinates.
      seriesCount += datum.points.length;
    }

    const xs = new Float32Array(seriesCount);
    const ys = new Float32Array(seriesCount);
    let arrIndex = 0;
    for (let i = 0; i < this.rawSeriesData.length; i++) {
      const {points} = this.rawSeriesData[i];
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
        xs[arrIndex] = points[pointIndex].x;
        ys[arrIndex] = points[pointIndex].y;
        arrIndex++;
      }
    }

    const {
      xs: convertedXs,
      ys: convertedYs,
    } = await this.coordinator.getViewCoordinateBatch(layoutRect, {xs, ys});

    arrIndex = 0;
    for (let i = 0; i < this.series.length; i++) {
      const {paths} = this.series[i];
      for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 2) {
        paths[pathIndex] = convertedXs[arrIndex];
        paths[pathIndex + 1] = convertedYs[arrIndex];
        arrIndex++;
      }
    }

    console.timeEnd('after');

    this.updateCoordinateIdentifier();
    this.markAsPaintDirty();
  }
}
