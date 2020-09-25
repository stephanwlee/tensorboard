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
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {Subject, fromEvent} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

import {Scale} from '../lib/scale';
import {ChartExportedLayouts, DataSeries, Rect, ViewExtent} from '../lib/types';

export interface TooltipDatum {
  name: string;
  color: string;
  point: {x: number; y: number};
}

enum InteractionState {
  NONE,
  ZOOMING,
  PANNING,
}

@Component({
  selector: 'line-chart-interactive-layer',
  templateUrl: './line_chart_interactive_layer.ng.html',
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

      .zoom-box {
        fill-opacity: 0.03;
        fill: #000;
        stroke: #ccc;
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
  viewExtent!: ViewExtent;

  @Input()
  xScale!: Scale;

  @Input()
  yScale!: Scale;

  @Input()
  overlayRefContainer!: ElementRef;

  @Output()
  onViewExtentChange = new EventEmitter<ViewExtent>();

  @Output()
  onViewExtentReset = new EventEmitter<void>();

  readonly InteractionState = InteractionState;

  state: InteractionState = InteractionState.NONE;
  zoomBoxInUiCoordinate: Rect = {x: 0, width: 0, height: 0, y: 0};

  readonly tooltipPositions: ConnectedPosition[] = [
    {
      offsetY: 5,
      originX: 'start',
      overlayX: 'start',
      originY: 'bottom',
      overlayY: 'top',
    },
  ];

  cursorXLocation: number | null = null;
  cursoredData: TooltipDatum[] = [];
  tooltipDislayAttached: boolean = false;

  private interactionOrigin: {x: number; y: number} | null = null;
  private readonly ngUnsubscribe = new Subject();

  trackBySeriesName(datum: TooltipDatum) {
    return datum.name;
  }

  getDotsBoxStyles() {
    if (!this.chartLayout || !this.chartLayout.lines) {
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
    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'dblclick', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => {
        this.onViewExtentReset.emit();
        this.state = InteractionState.NONE;
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mousedown', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        this.state = event.shiftKey
          ? InteractionState.PANNING
          : InteractionState.ZOOMING;
        this.interactionOrigin = {x: event.offsetX, y: event.offsetY};

        if (this.state === InteractionState.ZOOMING) {
          this.zoomBoxInUiCoordinate = {
            x: event.offsetX,
            width: 0,
            y: event.offsetY,
            height: 0,
          };
        }

        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mouseup', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        const zoomBox = this.zoomBoxInUiCoordinate;
        if (
          this.state === InteractionState.ZOOMING &&
          zoomBox.width > 5 &&
          zoomBox.height > 5
        ) {
          const {x: xMin, y: yMin} = this.convertDomCoordToDataCoord({
            x: zoomBox.x,
            y: zoomBox.y + zoomBox.height,
          });
          const {x: xMax, y: yMax} = this.convertDomCoordToDataCoord({
            x: zoomBox.x + zoomBox.width,
            y: zoomBox.y,
          });
          this.onViewExtentChange.emit({
            x: [xMin, xMax],
            y: [yMin, yMax],
          });
        }
        this.state = InteractionState.NONE;
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mouseleave', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        this.state = InteractionState.NONE;
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mousemove', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        switch (this.state) {
          case InteractionState.NONE:
            this.updateTooltip(event);
            this.changeDetector.markForCheck();
            break;
          case InteractionState.PANNING:
            this.updateTooltip(event);
            break;
          case InteractionState.ZOOMING:
            if (this.interactionOrigin) {
              const xs = [this.interactionOrigin.x, event.offsetX];
              const ys = [this.interactionOrigin.y, event.offsetY];
              this.zoomBoxInUiCoordinate = {
                x: Math.min(...xs),
                width: Math.max(...xs) - Math.min(...xs),
                y: Math.min(...ys),
                height: Math.max(...ys) - Math.min(...ys),
              };
            }
            this.changeDetector.markForCheck();
            break;
        }
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  transformX(x: number): number {
    if (!this.chartLayout || !this.chartLayout.lines) {
      return 0;
    }
    const lineLayout = this.chartLayout.lines;

    return this.xScale.forward(this.viewExtent.x, [0, lineLayout.width], x);
  }

  transformY(y: number): number {
    if (!this.chartLayout || !this.chartLayout.lines) {
      return 0;
    }
    const lineLayout = this.chartLayout.lines;

    return this.yScale.forward(this.viewExtent.y, [lineLayout.height, 0], y);
  }

  private convertDomCoordToDataCoord(mouseCoord: {
    x: number;
    y: number;
  }): {x: number; y: number} {
    if (!this.chartLayout || !this.chartLayout.lines) {
      return {x: 0, y: 0};
    }
    const lineLayout = this.chartLayout.lines;

    return {
      x: this.xScale.invert(
        this.viewExtent.x,
        [0, lineLayout.width],
        mouseCoord.x
      ),
      y: this.yScale.invert(
        this.viewExtent.y,
        [lineLayout.height, 0],
        mouseCoord.y
      ),
    };
  }

  private updateTooltip(event: MouseEvent) {
    this.cursorXLocation = this.convertDomCoordToDataCoord({
      x: event.offsetX,
      y: 0,
    }).x;
    this.updateCursoredData();
    this.tooltipDislayAttached = true;
  }

  onTooltipDisplayDetached() {
    this.tooltipDislayAttached = false;
  }

  ngOnChanges(changes: SimpleChanges) {
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
