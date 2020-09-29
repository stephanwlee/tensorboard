import {ElementRef} from '@angular/core';

import {Scale} from '../lib/scale';
import {ViewExtent} from '../lib/types';

export interface DomDimension {
  width: number;
  height: number;
}

export abstract class NgLineChartView {
  abstract viewExtent: ViewExtent;

  abstract xScale: Scale;

  abstract yScale: Scale;

  abstract domDimensions: DomDimension;

  protected readonly hostElRef: ElementRef;

  constructor(hostElRef: ElementRef) {
    this.hostElRef = hostElRef;
  }

  getDomX(dataX: number): number {
    return this.xScale.forward(
      this.viewExtent.x,
      [0, this.domDimensions.width],
      dataX
    );
  }

  getDataX(domX: number) {
    return this.xScale.invert(
      this.viewExtent.x,
      [0, this.domDimensions.width],
      domX
    );
  }

  getDomY(dataY: number): number {
    return this.yScale.forward(
      this.viewExtent.y,
      [this.domDimensions.height, 0],
      dataY
    );
  }

  getDataY(domY: number): number {
    return this.yScale.invert(
      this.viewExtent.y,
      [this.domDimensions.height, 0],
      domY
    );
  }
}
