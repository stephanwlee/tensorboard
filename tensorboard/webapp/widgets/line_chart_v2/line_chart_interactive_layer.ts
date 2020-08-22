import {
  CdkConnectedOverlay,
  CloseScrollStrategy,
  ConnectedPosition,
  Overlay,
} from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {Subject, fromEvent} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import {LinearScale} from './lib/scale';
import {ChartExportedLayouts, DataExtent, DataSeries} from './lib/types';

export interface TooltipDatum {
  name: string;
  color: string;
  point: {x: number; y: number};
}

@Component({
  selector: 'line-chart-interactive-layer',
  template: `
    <svg #dots class="dots" [style]="getDotsBoxStyles()">
      <circle
        *ngFor="let datum of cursoredData; trackBy: trackBySeriesName"
        [attr.cx]="lineContentXScale.getValue(datum.point.x)"
        [attr.cy]="lineContentYScale.getValue(datum.point.y)"
        [attr.fill]="datum.color"
        r="4"
      ></circle>
    </svg>
    <div
      class="tooltip-origin"
      cdkOverlayOrigin
      #tooltipOrigin="cdkOverlayOrigin"
    ></div>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="tooltipOrigin"
      [cdkConnectedOverlayOffsetX]="chartLayout?.lines.x"
      [cdkConnectedOverlayWidth]="chartLayout?.lines.width"
      [cdkConnectedOverlayOpen]="tooltipDislayAttached"
      [cdkConnectedOverlayPositions]="tooltipPositions"
      (detach)="onTooltipDisplayDetached()"
    >
      <div class="tooltip-container">
        <div
          *ngFor="let datum of cursoredData; trackBy: trackBySeriesName"
          class="tooltip-row"
        >
          <span class="circle" [style.backgroundColor]="datum.color"></span>
          <span>{{ datum.name }}</span
          >: <span>{{ datum.point.x }}</span
          >,
          <span>{{ datum.point.y }}</span>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        height: 100%;
        position: relative;
        width: 100%;
      }

      .dots {
        position: absolute;
      }

      .circle {
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 100%;
        display: inline-block;
        height: 10px;
        width: 10px;
      }

      .tooltip-origin {
        bottom: 0;
        left: 0;
        position: absolute;
        right: 0;
      }

      .tooltip-container {
        background: rgba(50, 50, 50, 0.85);
        color: #fff;
        padding: 5px;
        width: 100%;
      }
      .tooltip-row {
        display: flex;
        align-items: center;
      }

      .tooltip-row > span {
        margin: 0 5px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: CloseScrollStrategy,
      useClass: CloseScrollStrategy,
      deps: [Overlay],
    },
  ],
})
export class LineChartInteractiveLayerComponent
  implements OnChanges, OnDestroy {
  @ViewChild('dots', {static: true, read: ElementRef})
  dotsContainer!: ElementRef<SVGElement>;

  @ViewChild(CdkConnectedOverlay)
  overlay!: CdkConnectedOverlay;

  @Input()
  data!: DataSeries[];

  @Input()
  visibleSeries!: Set<string>;

  @Input()
  colorMap!: Map<string, string>;

  @Input()
  chartLayout!: ChartExportedLayouts | null;

  @Input()
  viewExtent!: DataExtent;

  private readonly ngUnsubscribe = new Subject();

  readonly tooltipPositions: ConnectedPosition[] = [
    {
      offsetY: 5,
      originX: 'start',
      overlayX: 'start',
      originY: 'bottom',
      overlayY: 'top',
    },
  ];

  lineContentXScale = new LinearScale();
  lineContentYScale = new LinearScale();
  cursorXLocation: number | null = null;
  cursoredData: TooltipDatum[] = [];
  tooltipDislayAttached: boolean = false;

  trackBySeriesName(datum: TooltipDatum) {
    return datum.name;
  }

  getDotsBoxStyles() {
    if (!this.chartLayout) {
      return {};
    }

    return {
      left: `${this.chartLayout.lines.x}px`,
      width: `${this.chartLayout.lines.width}px`,
      top: `${this.chartLayout.lines.y}px`,
      height: `${this.chartLayout.lines.height}px`,
    };
  }

  constructor(
    private readonly changeDetector: ChangeDetectorRef,
    readonly scrollStrategy: CloseScrollStrategy
  ) {}

  ngAfterViewInit() {
    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mousemove', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => this.updateTooltip(event));
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  private updateTooltip(event: MouseEvent) {
    this.cursorXLocation = this.lineContentXScale.invert(event.offsetX);
    this.updateCursoredData();
    this.tooltipDislayAttached = true;
  }

  onTooltipDisplayDetached() {
    this.tooltipDislayAttached = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chartLayout'] && this.chartLayout) {
      const lineLayout = this.chartLayout.lines;
      this.lineContentXScale.range(0, lineLayout.width);
      this.lineContentYScale.range(lineLayout.height, 0);
    }

    if (changes['viewExtent']) {
      this.lineContentXScale.domain(this.viewExtent.x[0], this.viewExtent.x[1]);
      this.lineContentYScale.domain(this.viewExtent.y[0], this.viewExtent.y[1]);
    }

    this.updateCursoredData();
  }

  private updateCursoredData() {
    if (this.cursorXLocation === null) {
      return;
    }

    this.cursoredData = this.data.map(({name, points}) => {
      return {
        name,
        point: this.binarySearchClosestPoint(points, this.cursorXLocation!),
        color: this.colorMap.get(name) || '#f00',
      };
    });
    this.changeDetector.markForCheck();
  }

  /**
   * @param points DataSeries points; assumed to be sorted in x.
   * @param targetX target `x` location.
   */
  private binarySearchClosestPoint(
    points: DataSeries['points'],
    targetX: number
  ): {x: number; y: number} {
    let left = 0;
    let right = points.length - 1;
    while (right - left > 1) {
      const mid = Math.ceil((right - left) / 2) + left;
      if (points[mid].x < targetX) {
        left = mid;
      } else if (points[mid].x >= targetX) {
        right = mid;
      } else {
        break;
      }
    }

    const closerToLeft =
      Math.abs(points[left].x - targetX) -
        Math.abs(points[right].x - targetX) >=
      0;
    return closerToLeft ? points[left] : points[right];
  }
}
