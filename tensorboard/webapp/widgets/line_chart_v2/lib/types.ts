export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DataSeries {
  id: string;
  points: Array<{x: number; y: number}>;
}

export enum ScaleType {
  LINEAR,
  LOG10,
}

/**
 * Flattened array of 2d coordinates.
 *
 * For instance, [x0, y0, x1, y1, ..., xn, yn].
 */
export type Paths = Float32Array;

export interface DataInternalSeries {
  id: string;
  paths: Paths;
}

export interface Extent {
  x: [number, number];
  y: [number, number];
}

export type DataExtent = Extent;

export type ViewExtent = Extent;

export interface DataSeriesMetadataMap {
  [id: string]: {
    id: string;
    displayName: string;
    visible: boolean;
    color: string;
  };
}

export type SeriesId = string;

export type VisibilityMap = Map<SeriesId, boolean>;

export enum RendererType {
  SVG,
  WEBGL,
}

export interface ChartExportedLayouts {
  xAxis: Rect | null;
  yAxis: Rect | null;
  lines: Rect | null;
}

export interface LayerCallbacks {
  onLayout(layouts: ChartExportedLayouts): void;
}

export interface BaseLayerOption {
  callbacks: LayerCallbacks;
  domRect: Rect;
  xScaleType: ScaleType;
  yScaleType: ScaleType;
}

export interface SvgLayerOption extends BaseLayerOption {
  type: RendererType.SVG;
  container: SVGElement;
}

export interface WebGlLayerOption extends BaseLayerOption {
  type: RendererType.WEBGL;
  devicePixelRatio: number;
  container: OffscreenCanvas | HTMLCanvasElement;
}

export type LayerOption = SvgLayerOption | WebGlLayerOption;

export enum ViewType {
  Y_AXIS_VIEW,
  X_AXIS_VIEW,
  FLEX_LAYOUT,
  GRID_VIEW,
  SERIES_LINE_VIEW,
  COMPOSITE_LAYOUT,
}

export type LayoutChildren = ReadonlyArray<ReadonlyArray<LayoutConfig>>;

export interface ChildlessLayoutConfig {
  type: ViewType.Y_AXIS_VIEW | ViewType.X_AXIS_VIEW | ViewType.GRID_VIEW;
  children: undefined;
}

export interface ChildfulLayoutConfig {
  type: ViewType.FLEX_LAYOUT | ViewType.SERIES_LINE_VIEW;
  children: LayoutChildren;
}

export interface CompositeLayoutConfig {
  type: ViewType.COMPOSITE_LAYOUT;
  children: ReadonlyArray<LayoutConfig>;
}

export type LayoutConfig =
  | ChildlessLayoutConfig
  | ChildfulLayoutConfig
  | CompositeLayoutConfig;
