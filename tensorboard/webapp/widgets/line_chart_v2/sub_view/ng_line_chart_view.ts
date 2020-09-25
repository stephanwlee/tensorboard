import {ElementRef} from '@angular/core';

import {Scale} from '../lib/scale';
import {ViewExtent} from '../lib/types';

export abstract class NgLineChartView {
  abstract viewExtent: ViewExtent;

  abstract xScale: Scale;

  abstract yScale: Scale;

  protected readonly hostElRef: ElementRef;

  constructor(hostElRef: ElementRef) {
    this.hostElRef = hostElRef;
    this.updateDomSizeCache();
  }

  private domSizeCache: {width: number; height: number} = {width: 0, height: 0};

  getDomSizeCache() {
    return this.domSizeCache;
  }

  updateDomSizeCache() {
    const element = this.hostElRef.nativeElement;
    this.domSizeCache = {
      width: element.clientWidth,
      height: element.clientHeight,
    };
  }

  getDomX(dataX: number): number {
    return this.xScale.forward(
      this.viewExtent.x,
      [0, this.getDomSizeCache().width],
      dataX
    );
  }

  getDataX(domX: number) {
    return this.xScale.invert(
      this.viewExtent.x,
      [0, this.getDomSizeCache().width],
      domX
    );
  }

  getDomY(dataY: number): number {
    return this.yScale.forward(
      this.viewExtent.y,
      [this.getDomSizeCache().height, 0],
      dataY
    );
  }

  getDataY(domY: number): number {
    return this.yScale.invert(
      this.viewExtent.y,
      [this.getDomSizeCache().height, 0],
      domY
    );
  }
}
