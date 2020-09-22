import * as THREE from 'three';

import {LinearScale, Scale} from './scale';
import {DataExtent, Rect} from './types';

type XCoordinate = number;
type YCoordinate = number;

/**
 * Definitions.
 *
 * Illustration: we are viewing a diagonal line that goes from <0, 0> -> <1, 2>
 * onto a canvas with size <100, 200>.
 *
 * - data coordinate: coordinate in raw data space. For example above, you would
 *     have a line by connecting two points at <0, 0> and <1, 2>.
 * - ui coordinate: coordinate of a data in pixel/view-space. For example above,
 *     a data at <0.5, 0.5> will be on <50, 100> in UI coordinates.
 * - internal coordinate: in case of webgl, you can use an internal static
 *     coordinate system as long as we move the camera around. In the end, WebGL
 *     will correctly display to the view.
 * - view box: a rect in data coordinate that describes what should be visible
 *     on the screen.
 */
export class Coordinator {
  protected xScale: Scale = new LinearScale();
  protected yScale: Scale = new LinearScale();
  protected domContainerRect: Rect = {
    x: 0,
    width: 1,
    y: 0,
    height: 1,
  };

  protected lastUpdated: number = 0;
  protected currentViewportRect: Rect = {
    x: 0,
    width: 1,
    y: 0,
    height: 1,
  };

  getUpdateIdentifier() {
    return this.lastUpdated;
  }

  setXScale(scale: Scale) {
    this.xScale = scale;
    this.lastUpdated = Date.now();
  }

  setYScale(scale: Scale) {
    this.yScale = scale;
    this.lastUpdated = Date.now();
  }

  setDataExtent(extent: DataExtent): void {
    this.xScale.domain(extent.x[0], extent.x[1]);
    this.yScale.domain(extent.y[0], extent.y[1]);
    this.lastUpdated = Date.now();
  }

  getCurrentViewportRect(): Rect {
    return this.currentViewportRect;
  }

  setViewportRect(rectInDataCoordinate: Rect) {
    const rect = rectInDataCoordinate;
    this.currentViewportRect = rectInDataCoordinate;
    this.xScale.domain(rect.x, rect.x + rect.width);
    this.yScale.domain(rect.y, rect.y + rect.height);
    this.lastUpdated = Date.now();
  }

  setDomContainerRect(rect: Rect) {
    this.domContainerRect = rect;
    this.lastUpdated = Date.now();
  }

  getViewCoordinate(
    rectInUiCoordinate: Rect,
    dataCoordinate: [XCoordinate, YCoordinate]
  ): [XCoordinate, YCoordinate] {
    const rect = rectInUiCoordinate;
    this.xScale.range(rect.x, rect.x + rect.width);
    this.yScale.range(rect.y + rect.height, rect.y);
    return [
      this.xScale.getValue(dataCoordinate[0]),
      this.yScale.getValue(dataCoordinate[1]),
    ];
  }

  /**
   * Converts size in browser pixel to the native coordinate dimensions.
   */
  getVerticalSize(paddingInPixel: number): number {
    return paddingInPixel;
  }

  /**
   * Converts a padding in browser pixel to the native coordinate dimensions.
   *
   * Unlike the `getVerticalSize` counterpart, this may return a negative value
   * depending on a coordinate system.
   */
  getVerticalPaddingSize(paddingInPixel: number): number {
    return paddingInPixel;
  }

  /**
   * Converts a padding in browser pixel to the native coordinate dimensions.
   */
  getHorizontalPaddingSize(paddingInPixel: number): number {
    return paddingInPixel;
  }
}

export class THREECoordinator extends Coordinator {
  private readonly CAMERA_BOUNDS: [number, number] = [0, 1000];
  private readonly camera = new THREE.OrthographicCamera(
    this.CAMERA_BOUNDS[0],
    this.CAMERA_BOUNDS[1],
    this.CAMERA_BOUNDS[1],
    this.CAMERA_BOUNDS[0],
    -100,
    100
  );

  private readonly uiToCameraXScale = new LinearScale().range(
    this.CAMERA_BOUNDS[0],
    this.CAMERA_BOUNDS[1]
  );
  private readonly uiToCameraYScale = new LinearScale().range(
    this.CAMERA_BOUNDS[0],
    this.CAMERA_BOUNDS[1]
  );

  setDomContainerRect(rect: Rect) {
    super.setDomContainerRect(rect);
    this.xScale.range(rect.x, rect.x + rect.width);
    this.yScale.range(rect.y + rect.height, rect.y);
    this.uiToCameraXScale.domain(rect.x, rect.x + rect.width);
    this.uiToCameraYScale.domain(rect.y + rect.height, rect.y);
    this.adjustCamera();
  }

  setViewportRect(rectInDataCoordinate: Rect) {
    // When adjusting view, we only need to modify the camera and not update the
    // internal coordinate system. We don't need to update the update
    // identifier.
    this.currentViewportRect = rectInDataCoordinate;
    this.adjustCamera();
  }

  private adjustCamera(): void {
    const domRect = this.domContainerRect;
    this.xScale.range(domRect.x, domRect.x + domRect.width);
    this.yScale.range(domRect.y + domRect.height, domRect.y);

    const viewRect = this.getCurrentViewportRect();
    this.camera.left = this.uiToCameraXScale.getValue(
      this.xScale.getValue(viewRect.x)
    );
    this.camera.right = this.uiToCameraXScale.getValue(
      this.xScale.getValue(viewRect.x + viewRect.width)
    );
    this.camera.top = this.uiToCameraYScale.getValue(
      this.yScale.getValue(viewRect.y + viewRect.height)
    );
    this.camera.bottom = this.uiToCameraYScale.getValue(
      this.yScale.getValue(viewRect.y)
    );
    console.log(
      'camera update',
      domRect,
      viewRect,
      this.camera.left,
      this.camera.right,
      this.camera.top,
      this.camera.bottom
    );
    this.camera.updateProjectionMatrix();
  }

  setXScale(scale: Scale) {
    super.setXScale(scale);
    this.xScale.range(this.CAMERA_BOUNDS[0], this.CAMERA_BOUNDS[1]);
  }

  setYScale(scale: Scale) {
    super.setYScale(scale);
    this.yScale.range(this.CAMERA_BOUNDS[0], this.CAMERA_BOUNDS[1]);
  }

  getViewCoordinate(
    rectInUiCoordinate: Rect,
    dataCoordinate: [XCoordinate, YCoordinate]
  ): [XCoordinate, YCoordinate] {
    const [x, y] = super.getViewCoordinate(rectInUiCoordinate, dataCoordinate);
    return [
      this.uiToCameraXScale.getValue(x),
      this.uiToCameraYScale.getValue(y),
    ];
  }

  getCamera() {
    return this.camera;
  }

  /**
   * Converts size in browser pixel to the native coordinate dimensions.
   */
  getVerticalSize(paddingInPixel: number): number {
    const [domBottom, domTop] = this.uiToCameraYScale.getDomain();
    return Math.abs(
      ((this.camera.bottom - this.camera.top) / (domBottom - domTop)) *
        paddingInPixel
    );
  }

  /**
   * Converts size in browser pixel to the native coordinate dimensions.
   */
  getVerticalPaddingSize(paddingInPixel: number): number {
    const [domBottom, domTop] = this.uiToCameraYScale.getDomain();
    return (
      ((this.camera.bottom - this.camera.top) / (domBottom - domTop)) *
      paddingInPixel
    );
  }

  /**
   * Converts size in browser pixel to the native coordinate dimensions.
   */
  getHorizontalPaddingSize(paddingInPixel: number): number {
    const [domLeft, domRight] = this.uiToCameraXScale.getDomain();
    return (
      ((this.camera.right - this.camera.left) / (domRight - domLeft)) *
      paddingInPixel
    );
  }
}
