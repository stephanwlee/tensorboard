import {DrawableConfig} from './drawable';
import {LayoutOption} from './layout';
import {RootLayout} from './root_layout';
import {
  DataExtent,
  DataSeries,
  DataSeriesMetadataMap,
  LayerOption,
  LayoutChildren,
  Rect,
  ScaleType,
  ViewExtent,
} from './types';

export type LayoutCreator = (
  option: LayoutOption & DrawableConfig,
  domRect: Rect
) => RootLayout;

export abstract class ILayer {
  constructor(id: number, option: LayerOption, layouts: LayoutChildren) {}

  abstract resize(rect: Rect): void;

  abstract updateMetadata(metadataMap: DataSeriesMetadataMap): void;

  abstract updateViewbox(extent: ViewExtent): void;

  abstract updateData(data: DataSeries[]): void;

  abstract setXScaleType(type: ScaleType): void;

  abstract setYScaleType(type: ScaleType): void;

  dispose(): void {}
}
