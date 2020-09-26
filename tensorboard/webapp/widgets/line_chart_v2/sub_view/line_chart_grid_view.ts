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
import {AxisView} from './line_chart_axis_view';

@Component({
  selector: 'line-chart-grid-view',
  template: `<svg>
    <line
      *ngFor="let tick of ticks.x; trackBy: trackByTick"
      [class.zero]="tick === 0"
      [attr.x1]="getDomX(tick)"
      y1="0"
      [attr.x2]="getDomX(tick)"
      [attr.y2]="getDomSizeCache().height"
    ></line>
    <line
      *ngFor="let tick of ticks.y; trackBy: trackByTick"
      [class.zero]="tick === 0"
      x1="0"
      [attr.y1]="getDomY(tick)"
      [attr.x2]="getDomSizeCache().width"
      [attr.y2]="getDomY(tick)"
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
        stroke: #aaa;
        stroke-width: 1.5px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartGridView extends AxisView {
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

  constructor(hostElRef: ElementRef) {
    super(hostElRef);
  }
}
