import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {ticks} from 'd3-array';

import {Scale} from '../lib/scale';
import {ViewExtent} from '../lib/types';

@Component({
  selector: 'line-chart-grid-view',
  template: `<svg>
    <line
      *ngFor="let tick of ticks.x; trackBy: trackByTick"
      [attr.x1]="getDomX(tick)"
      y1="0"
      [attr.x2]="getDomX(tick)"
      [attr.y2]="domDimensions.height"
    ></line>
    <line
      *ngFor="let tick of ticks.y; trackBy: trackByTick"
      x1="0"
      [attr.y1]="getDomY(tick)"
      [attr.x2]="domDimensions.width"
      [attr.y2]="getDomY(tick)"
    ></line>
    <line
      class="zero"
      x1="0"
      [attr.y1]="getDomY(0)"
      [attr.x2]="domDimensions.width"
      [attr.y2]="getDomY(0)"
    ></line>

    <line
      class="zero"
      [attr.x1]="getDomX(0)"
      y1="0"
      [attr.x2]="getDomX(0)"
      [attr.y2]="domDimensions.height"
    ></line>
  </svg>`,
  styles: [
    `
      :host {
        display: block;
        overflow: hidden;
      }

      svg {
        height: 100%;
        width: 100%;
      }

      line {
        stroke: #ccc;
        stroke-width: 1px;
      }

      .zero {
        stroke: #777;
        stroke-width: 1.5px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartGridView implements OnChanges {
  @Input()
  viewExtent!: ViewExtent;

  @Input()
  xScale!: Scale;

  @Input()
  xGridCount!: number;

  @Input()
  yScale!: Scale;

  @Input()
  yGridCount!: number;

  domDimensions: {width: number; height: number} = {
    width: 0,
    height: 0,
  };

  ticks: {x: number[]; y: number[]} = {x: [], y: []};

  constructor(hostElRef: ElementRef) {
    this.domDimensions = {
      width: hostElRef.nativeElement.clientWidth,
      height: hostElRef.nativeElement.clientHeight,
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewExtent']) {
      this.ticks = {
        x: ticks(this.viewExtent.x[0], this.viewExtent.x[1], this.xGridCount),
        y: ticks(this.viewExtent.y[0], this.viewExtent.y[1], this.yGridCount),
      };
    }
  }

  trackByTick(tick: number) {
    return tick;
  }

  getDomX(dataX: number): number {
    return this.xScale.forward(
      this.viewExtent.x,
      [0, this.domDimensions.width],
      dataX
    );
  }

  getDomY(dataY: number): number {
    return this.yScale.forward(
      this.viewExtent.y,
      [0, this.domDimensions.height],
      dataY
    );
  }
}
