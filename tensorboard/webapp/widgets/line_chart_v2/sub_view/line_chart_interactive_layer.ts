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
  ViewChild,
  HostBinding,
} from '@angular/core';
import {bisect} from 'd3-array';
import {Subject, fromEvent, of, timer} from 'rxjs';
import {filter, map, switchMap, takeUntil, tap} from 'rxjs/operators';

import {DomDimension, NgLineChartView} from './ng_line_chart_view';
import {Scale} from '../lib/scale';
import {
  DataSeries,
  DataSeriesMetadataMap,
  Rect,
  ViewExtent,
} from '../lib/types';

export interface TooltipDatum {
  id: string;
  displayName: string;
  color: string;
  point: {x: number; y: number} | null;
}

enum InteractionState {
  NONE,
  DRAG_ZOOMING,
  SCROLL_ZOOMING,
  PANNING,
}

const SCROLL_ZOOM_SPEED_FACTOR = 0.01;

@Component({
  selector: 'line-chart-interactive-layer',
  templateUrl: './line_chart_interactive_layer.ng.html',
  styleUrls: ['./line_chart_interactive_layer.css'],
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
  extends NgLineChartView
  implements OnChanges, OnDestroy {
  @ViewChild('dots', {static: true, read: ElementRef})
  dotsContainer!: ElementRef<SVGElement>;

  @ViewChild(CdkConnectedOverlay)
  overlay!: CdkConnectedOverlay;

  @Input()
  seriesData!: DataSeries[];

  @Input()
  seriesMetadataMap!: DataSeriesMetadataMap;

  @Input()
  viewExtent!: ViewExtent;

  @Input()
  xScale!: Scale;

  @Input()
  yScale!: Scale;

  @Input()
  overlayRefContainer!: ElementRef;

  @Input()
  domDimensions!: DomDimension;

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

  @HostBinding('class.show-zoom-instruction')
  showZoomInstruction: boolean = false;

  private interactionOrigin: {x: number; y: number} | null = null;
  private isCursorInside = false;
  private readonly ngUnsubscribe = new Subject();

  constructor(
    readonly hostElRef: ElementRef,
    private readonly changeDetector: ChangeDetectorRef,
    readonly scrollStrategy: CloseScrollStrategy
  ) {
    super(hostElRef);
  }

  ngAfterViewInit() {
    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'dblclick', {
      passive: false,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        // Prevent double click from selecting text.
        event.preventDefault();
        this.onViewExtentReset.emit();
        this.state = InteractionState.NONE;
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mousedown', {
      passive: false,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        event.preventDefault();
        this.state = event.shiftKey
          ? InteractionState.PANNING
          : InteractionState.DRAG_ZOOMING;
        this.interactionOrigin = {x: event.offsetX, y: event.offsetY};

        if (this.state === InteractionState.DRAG_ZOOMING) {
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
      .subscribe(() => {
        const zoomBox = this.zoomBoxInUiCoordinate;
        if (
          this.state === InteractionState.DRAG_ZOOMING &&
          zoomBox.width > 0 &&
          zoomBox.height > 0
        ) {
          const xMin = this.getDataX(zoomBox.x);
          const xMax = this.getDataX(zoomBox.x + zoomBox.width);
          const yMin = this.getDataY(zoomBox.y + zoomBox.height);
          const yMax = this.getDataY(zoomBox.y);

          this.onViewExtentChange.emit({
            x: [xMin, xMax],
            y: [yMin, yMax],
          });
        }
        if (this.state !== InteractionState.NONE) {
          this.state = InteractionState.NONE;
          this.changeDetector.markForCheck();
        }
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mouseenter', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        this.isCursorInside = true;
        this.updateTooltip(event);
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mouseleave', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        this.isCursorInside = false;
        this.state = InteractionState.NONE;
        this.changeDetector.markForCheck();
      });

    fromEvent<MouseEvent>(this.dotsContainer.nativeElement, 'mousemove', {
      passive: true,
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((event) => {
        switch (this.state) {
          case InteractionState.SCROLL_ZOOMING: {
            this.state = InteractionState.NONE;
            this.updateTooltip(event);
            this.changeDetector.markForCheck();
            break;
          }
          case InteractionState.NONE:
            this.updateTooltip(event);
            this.changeDetector.markForCheck();
            break;
          case InteractionState.PANNING: {
            if (!this.interactionOrigin) {
              break;
            }
            const deltaX = -event.movementX;
            const deltaY = -event.movementY;
            const {width: domWidth, height: domHeight} = this.domDimensions;
            const xMin = this.getDataX(deltaX);
            const xMax = this.getDataX(domWidth + deltaX);
            const yMin = this.getDataY(domHeight + deltaY);
            const yMax = this.getDataY(deltaY);
            this.onViewExtentChange.emit({
              x: [xMin, xMax],
              y: [yMin, yMax],
            });
            break;
          }
          case InteractionState.DRAG_ZOOMING:
            {
              if (!this.interactionOrigin) {
                break;
              }
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

    fromEvent<WheelEvent>(this.dotsContainer.nativeElement, 'wheel', {
      passive: false,
    })
      .pipe(
        takeUntil(this.ngUnsubscribe),
        switchMap((event: WheelEvent) => {
          const shouldZoom = !event.ctrlKey && !event.shiftKey && event.altKey;
          this.showZoomInstruction = !shouldZoom;
          this.changeDetector.markForCheck();

          if (shouldZoom) {
            return of(event);
          }
          return timer(3000).pipe(
            tap(() => {
              this.showZoomInstruction = false;
              this.changeDetector.markForCheck();
            }),
            map(() => null)
          );
        }),
        filter((eventOrNull) => Boolean(eventOrNull))
      )
      .subscribe((eventOrNull) => {
        const event = eventOrNull!;
        event.preventDefault();

        let factor: number;
        switch (event.deltaMode) {
          case WheelEvent.DOM_DELTA_PIXEL:
            factor = 1;
            break;
          case WheelEvent.DOM_DELTA_LINE:
            factor = 8;
            break;
          case WheelEvent.DOM_DELTA_PAGE:
            factor = 20;
            break;
          default:
            factor = 1;
            console.warn(`Unknown WheelEvent deltaMode: ${event.deltaMode}.`);
        }

        const {width, height} = this.domDimensions;
        // When scrolling with mouse hover overed to the right edge, we want to scroll less to the right.
        const biasX = event.offsetX / width;
        const biasY = (height - event.offsetY) / height;
        const magnitude = event.deltaY * factor;
        const zoomFactor =
          1 + magnitude < 0
            ? // Prevent zoomFactor to go 0 in all case.
              Math.max(magnitude * SCROLL_ZOOM_SPEED_FACTOR, -0.95)
            : magnitude * SCROLL_ZOOM_SPEED_FACTOR;

        this.onViewExtentChange.emit(
          this.proposeViewExtentOnZoom(
            this.viewExtent,
            zoomFactor,
            biasX,
            biasY
          )
        );

        if (this.state !== InteractionState.SCROLL_ZOOMING) {
          this.state = InteractionState.SCROLL_ZOOMING;
          this.changeDetector.markForCheck();
        }
      });
  }

  ngOnChanges() {
    this.updateCursoredDataAndTooltipVisibility();
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  trackBySeriesName(datum: TooltipDatum) {
    return datum.id;
  }

  private updateTooltip(event: MouseEvent) {
    this.cursorXLocation = this.getDataX(event.offsetX);
    this.updateCursoredDataAndTooltipVisibility();
  }

  private proposeViewExtentOnZoom(
    viewExtent: ViewExtent,
    factor: number,
    biasX: number,
    biasY: number
  ): ViewExtent {
    // We want the zoom origin to be exactly at the cursor. This means we need to make sure
    // to zoom in correct proportion according to the biases.
    const spreadX = viewExtent.x[1] - viewExtent.x[0];
    const deltaX = spreadX * factor;
    const spreadY = viewExtent.y[1] - viewExtent.y[0];
    const deltaY = spreadY * factor;

    const proposedX: [number, number] = [
      viewExtent.x[0] - deltaX * biasX,
      viewExtent.x[1] + deltaX * (1 - biasX),
    ];
    const proposedY: [number, number] = [
      viewExtent.y[0] - deltaY * biasY,
      viewExtent.y[1] + deltaY * (1 - biasY),
    ];

    return {
      x: proposedX[1] < proposedX[0] ? [proposedX[1], proposedX[0]] : proposedX,
      y: proposedY[1] < proposedY[0] ? [proposedY[1], proposedY[0]] : proposedY,
    };
  }

  onTooltipDisplayDetached() {
    this.tooltipDislayAttached = false;
  }

  private updateCursoredDataAndTooltipVisibility() {
    if (this.cursorXLocation === null) {
      return;
    }

    this.cursoredData = this.seriesData
      .filter(({id}) => {
        return this.seriesMetadataMap[id]?.visible;
      })
      .map(({id, points}) => {
        return {
          id,
          displayName: this.seriesMetadataMap[id]?.displayName || id,
          point: this.findClosestPoint(points, this.cursorXLocation!),
          color: this.seriesMetadataMap[id]?.color || '#f00',
        };
      });
    this.tooltipDislayAttached =
      this.isCursorInside &&
      this.cursoredData.some(({point}) => Boolean(point));
  }

  /**
   * @param points DataSeries points; assumed to be sorted in x.
   * @param targetX target `x` location.
   */
  private findClosestPoint(
    points: DataSeries['points'],
    targetX: number
  ): {x: number; y: number} | null {
    const right = Math.min(
      bisect(
        points.map(({x}) => x),
        targetX
      ),
      points.length - 1
    );

    const left = Math.max(0, right - 1);
    const closerToLeft =
      Math.abs(points[left].x - targetX) -
        Math.abs(points[right].x - targetX) <=
      0;
    return closerToLeft ? points[left] : points[right];
  }
}
