import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {format} from 'd3-format';

import {Scale} from '../lib/scale';
import {Extent} from '../lib/types';
import {NgLineChartView} from './ng_line_chart_view';

const d3AxisFormatter = format('.2~e');
const d3AxisIntFormatter = format('~');

function axisFormatter(num: number): string {
  if (num === 0) {
    return '0';
  }

  const absNum = Math.abs(num);
  if (absNum >= 1000 || absNum <= 0.001) {
    return d3AxisFormatter(num);
  }
  return d3AxisIntFormatter(num);
}

export abstract class AxisView extends NgLineChartView implements OnChanges {
  constructor(readonly hostElRef: ElementRef) {
    super(hostElRef);
  }

  abstract xGridCount = 10;
  abstract yGridCount = 10;

  ticks: {x: number[]; y: number[]} = {x: [], y: []};

  trackByTick(tick: number) {
    return tick;
  }

  getTickString(tick: number): string {
    return axisFormatter(tick);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewExtent']) {
      let xTicks: number[] = [];
      let yTicks: number[] = [];

      if (this.xScale) {
        xTicks = this.xScale.ticks(this.viewExtent.x, this.xGridCount);
      }

      if (this.yScale) {
        yTicks = this.yScale.ticks(this.viewExtent.y, this.yGridCount);
      }

      this.ticks = {
        x: xTicks,
        y: yTicks,
      };
    }
  }
}

@Component({
  selector: 'line-chart-x-axis',
  template: `<svg detectResize (onResize)="updateDomSizeCache()">
    <line x1="0" y1="0" [attr.x2]="getDomSizeCache().width" y2="0"></line>
    <ng-container *ngFor="let tick of ticks.x; trackBy: trackByTick">
      <text [attr.y]="5" [attr.x]="getDomX(tick)">
        {{ getTickString(tick) }}
      </text>
    </ng-container>
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
        stroke: #333;
        stroke-width: 1px;
      }

      text {
        dominant-baseline: hanging;
        font-size: 11px;
        text-anchor: middle;
        user-select: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartXAxisComponent extends AxisView {
  @Input()
  viewExtent!: Extent;

  @Input()
  xScale!: Scale;

  @Input()
  yScale!: Scale;

  @Input()
  xGridCount!: number;

  @Input()
  yGridCount!: number;

  constructor(readonly hostElRef: ElementRef) {
    super(hostElRef);
  }
}

@Component({
  selector: 'line-chart-y-axis',
  template: `<svg detectResize (onResize)="updateDomSizeCache()">
    <line
      [attr.x1]="getDomSizeCache().width"
      y1="0"
      [attr.x2]="getDomSizeCache().width"
      [attr.y2]="getDomSizeCache().height"
    ></line>
    <ng-container *ngFor="let tick of ticks.y; trackBy: trackByTick">
      <text [attr.x]="getDomSizeCache().width - 5" [attr.y]="getDomY(tick)">
        {{ getTickString(tick) }}
      </text>
    </ng-container>
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
        stroke: #333;
        stroke-width: 1px;
      }

      text {
        dominant-baseline: central;
        font-size: 11px;
        text-anchor: end;
        user-select: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartYAxisComponent extends AxisView {
  @Input()
  viewExtent!: Extent;

  @Input()
  xScale!: Scale;

  @Input()
  yScale!: Scale;

  @Input()
  xGridCount!: number;

  @Input()
  yGridCount!: number;

  constructor(readonly hostElRef: ElementRef) {
    super(hostElRef);
  }
}
