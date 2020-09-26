import {
  ChartExportedLayouts,
  DataExtent,
  DataSeriesMetadataMap,
  LayoutChildren,
  Rect,
  RendererType,
  ScaleType,
  ViewExtent,
} from './types';

export {RendererType} from './types';

export enum MainToGuestEvent {
  SERIES_DATA_UPDATE,
  SERIES_METADATA_CHANGED,
  SCALE_UPDATE,
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
  rendererType: RendererType.WEBGL | RendererType.CANVAS;
  layouts: LayoutChildren;
  xScaleType: ScaleType;
  yScaleType: ScaleType;
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

export interface ScaleUpdateMessage {
  type: MainToGuestEvent.SCALE_UPDATE;
  axis: 'x' | 'y';
  scaleType: ScaleType;
}

export type MainToGuestMessage =
  | UpdateMessage
  | ResizeMessage
  | ScaleUpdateMessage
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
