export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DataSeries {
  name: string;
  points: Array<{x: number; y: number}>;
}

/**
 * Flattened array of 2d coordinates.
 *
 * For instance, [x0, y0, x1, y1, ..., xn, yn].
 */
export type Paths = Float32Array;

export interface DataInternalSeries {
  name: string;
  paths: Paths;
}

interface Extent {
  x: [number, number];
  y: [number, number];
}

export type DataExtent = Extent;

export type ViewExtent = Extent;

export interface DataSeriesMetadataMap {
  [id: string]: {name: string; visible: boolean; color: string};
}

export type SeriesId = string;

export type VisibilityMap = Map<SeriesId, boolean>;

export enum ChartType {
  SVG,
  CANVAS,
  WEBGL,
}

export interface SvgLineChartOption {
  type: ChartType.SVG;
  container: SVGElement;
}

export interface CanvasLineChartOption {
  type: ChartType.CANVAS;
  devicePixelRatio: number;
  container: OffscreenCanvas | HTMLCanvasElement;
}

export interface WebGlLineChartOption {
  type: ChartType.WEBGL;
  devicePixelRatio: number;
  container: OffscreenCanvas | HTMLCanvasElement;
}

export type LineChartOption =
  | SvgLineChartOption
  | CanvasLineChartOption
  | WebGlLineChartOption;

export interface ChartExportedLayouts {
  xAxis: Rect;
  yAxis: Rect;
  lines: Rect;
}

export interface LineChartCallbacks {
  onLayout(layouts: ChartExportedLayouts): void;
}

export interface ILineChart {
  resize(rect: Rect): void;

  updateMetadata(metadataMap: DataSeriesMetadataMap): void;

  updateViewbox(extent: Extent): void;

  updateData(data: DataSeries[], extent: Extent): void;
}
