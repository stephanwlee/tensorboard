import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {ticks} from 'd3-array';

import {Scale} from '../lib/scale';
import {ViewExtent} from '../lib/types';

@Component({
  selector: 'line-chart-x-axis',
  template: `<svg>
    <line x1="0" y1="0" [attr.x2]="domDimensions.width" y2="0"></line>
    <g>
      <ng-container *ngFor="let tick of ticks; trackBy: trackByTick">
        <text [attr.y]="5" [attr.x]="getDomX(tick)">
          {{ tick }}
        </text>
      </ng-container>
    </g>
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
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartXAxisComponent implements OnChanges {
  @Input()
  viewExtent!: ViewExtent;

  @Input()
  xScale!: Scale;

  @Input()
  xGridCount!: number;

  domDimensions: {width: number; height: number} = {
    width: 0,
    height: 0,
  };

  ticks: number[] = [];

  constructor(hostElRef: ElementRef) {
    this.domDimensions = {
      width: hostElRef.nativeElement.clientWidth,
      height: hostElRef.nativeElement.clientHeight,
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewExtent']) {
      this.ticks = ticks(
        this.viewExtent.x[0],
        this.viewExtent.x[1],
        this.xGridCount
      );
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
}

@Component({
  selector: 'line-chart-y-axis',
  template: `<svg>
    <line
      [attr.x1]="domDimensions.width"
      y1="0"
      [attr.x2]="domDimensions.width"
      [attr.y2]="domDimensions.height"
    ></line>
    <g>
      <ng-container *ngFor="let tick of ticks; trackBy: trackByTick">
        <text [attr.x]="domDimensions.width - 5" [attr.y]="getDomY(tick)">
          {{ tick }}
        </text>
      </ng-container>
    </g>
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
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartYAxisComponent implements OnChanges {
  @Input()
  viewExtent!: ViewExtent;

  @Input()
  yScale!: Scale;

  @Input()
  yGridCount!: number;

  domDimensions: {width: number; height: number} = {
    width: 0,
    height: 0,
  };

  ticks: number[] = [];

  constructor(hostElRef: ElementRef) {
    this.domDimensions = {
      width: hostElRef.nativeElement.clientWidth,
      height: hostElRef.nativeElement.clientHeight,
    };
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewExtent']) {
      this.ticks = ticks(
        this.viewExtent.y[0],
        this.viewExtent.y[1],
        this.yGridCount
      );
    }
  }

  trackByTick(tick: number) {
    return tick;
  }

  getDomY(dataY: number): number {
    return this.yScale.forward(
      this.viewExtent.y,
      [0, this.domDimensions.height],
      dataY
    );
  }
}
