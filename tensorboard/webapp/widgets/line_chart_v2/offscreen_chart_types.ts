import {
  ChartExportedLayouts,
  ChartType,
  DataExtent,
  DataSeriesMetadataMap,
  Rect,
  ViewExtent,
} from './lib/types';

export {ChartType} from './lib/types';

export enum MainToGuestEvent {
  SERIES_DATA_UPDATE,
  SERIES_METADATA_CHANGED,
  UPDATE_VIEW_BOX,
  INIT,
  RESIZE,
}

export interface InitMessage {
  type: MainToGuestEvent.INIT;
  workerId: number;
  canvas: OffscreenCanvas;
  devicePixelRatio: number;
  rect: Rect;
  // Cannot support SVG in the offscreen.
  chartType: ChartType.WEBGL | ChartType.CANVAS;
}

export interface UpdateMessage {
  type: MainToGuestEvent.UPDATE_VIEW_BOX;
  extent: ViewExtent;
}

export interface ResizeMessage {
  type: MainToGuestEvent.RESIZE;
  rect: Rect;
}

export interface SeriesUpdateMessage {
  type: MainToGuestEvent.SERIES_DATA_UPDATE;
  namesAndLengths: Array<{
    name: string;
    length: number;
  }>;
  flattenedSeries: ArrayBufferLike;
  extent: DataExtent;
}

export type SeriesMetadataMap = DataSeriesMetadataMap;

export interface SeriesMetadataChangedeMessage {
  type: MainToGuestEvent.SERIES_METADATA_CHANGED;
  metadata: SeriesMetadataMap;
}

export type MainToGuestMessage =
  | UpdateMessage
  | ResizeMessage
  | SeriesUpdateMessage
  | SeriesMetadataChangedeMessage;

export enum GuestToMainType {
  LAYOUT_CHANGED,
}

export interface LayoutChangedMessage {
  type: GuestToMainType.LAYOUT_CHANGED;
  layouts: ChartExportedLayouts;
}

export type GuestToMainMessage = LayoutChangedMessage;
