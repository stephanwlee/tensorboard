/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {Store} from '@ngrx/store';
import {DataLoadState} from '../../../types/data';
import {combineLatest, from, Observable, of} from 'rxjs';
import {
  shareReplay,
  combineLatestWith,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';

import {State} from '../../../app_state';
import {
  getCardPinnedState,
  getCurrentRouteRunSelection,
  getExperimentIdForRunId,
  getExperimentIdToAliasMap,
  getRun,
  getRunColorMap,
} from '../../../selectors';
import {RunColorScale} from '../../../types/ui';
import {PluginType, ScalarStepDatum} from '../../data_source';
import {
  getCardLoadState,
  getCardMetadata,
  getCardTimeSeries,
  getMetricsIgnoreOutliers,
  getMetricsScalarSmoothing,
  getMetricsTooltipSort,
  getMetricsXAxisType,
  RunToSeries,
} from '../../store';
import {CardId, CardMetadata, XAxisType} from '../../types';
import {CardRenderer} from '../metrics_view_types';
import {getTagDisplayName} from '../utils';

import {SeriesDataList, SeriesPoint} from './scalar_card_component';
import {getDisplayNameForRun} from './utils';
import {
  DataSeries,
  DataSeriesMetadata,
  DataSeriesMetadataMap,
} from '../../../widgets/line_chart_v2/lib/types';
import {classicSmoothing} from '../../../widgets/line_chart_v2/data_transformer';

type ScalarCardMetadata = CardMetadata & {
  plugin: PluginType.SCALARS;
};

function areSeriesDataListEqual(
  listA: SeriesDataList,
  listB: SeriesDataList
): boolean {
  if (listA.length !== listB.length) {
    return false;
  }
  return listA.every((listAVal, index) => {
    const listBVal = listB[index];
    const listAPoints = listAVal.points;
    const listBPoints = listBVal.points;
    return (
      listAVal.seriesId === listBVal.seriesId &&
      listAVal.metadata.displayName === listBVal.metadata.displayName &&
      listAVal.visible === listBVal.visible &&
      listAPoints.length === listBPoints.length &&
      listAPoints.every((listAPoint, index) => {
        const listBPoint = listBPoints[index];
        return listAPoint.x === listBPoint.x && listAPoint.y === listBPoint.y;
      })
    );
  });
}

interface ScalarCardSeriesMetadata extends DataSeriesMetadata {
  smoothOf: string | null;
  smoothedBy: string | null;
}

@Component({
  selector: 'scalar-card',
  template: `
    <scalar-card-component
      [loadState]="loadState$ | async"
      [runColorScale]="runColorScale"
      [title]="title$ | async"
      [tag]="tag$ | async"
      [seriesDataList]="seriesDataList$ | async"
      [tooltipSort]="tooltipSort$ | async"
      [ignoreOutliers]="ignoreOutliers$ | async"
      [xAxisType]="xAxisType$ | async"
      [scalarSmoothing]="scalarSmoothing$ | async"
      [showFullSize]="showFullSize"
      [isPinned]="isPinned$ | async"
      [colorMap]="colorMap$ | async"
      [dataSeries]="dataSeries$ | async"
      [visibleSeries]="visibleSeries$ | async"
      [chartMetadataMap]="chartMetadataMap$ | async"
      (onFullSizeToggle)="onFullSizeToggle()"
      (onPinClicked)="pinStateChanged.emit($event)"
    ></scalar-card-component>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScalarCardContainer implements CardRenderer, OnInit {
  constructor(private readonly store: Store<State>) {}

  @Input() cardId!: CardId;
  @Input() groupName!: string | null;
  @Input() runColorScale!: RunColorScale;
  @Output() fullWidthChanged = new EventEmitter<boolean>();
  @Output() fullHeightChanged = new EventEmitter<boolean>();
  @Output() pinStateChanged = new EventEmitter<boolean>();

  loadState$?: Observable<DataLoadState>;
  title$?: Observable<string>;
  tag$?: Observable<string>;
  seriesDataList$?: Observable<SeriesDataList> = of([]);
  isPinned$?: Observable<boolean>;
  dataSeries$?: Observable<DataSeries[]>;
  colorMap$?: Observable<Map<string, string>>;
  visibleSeries$?: Observable<Set<string>>;
  chartMetadataMap$?: Observable<
    DataSeriesMetadataMap<ScalarCardSeriesMetadata>
  >;

  readonly tooltipSort$ = this.store.select(getMetricsTooltipSort);
  readonly ignoreOutliers$ = this.store.select(getMetricsIgnoreOutliers);
  readonly xAxisType$ = this.store.select(getMetricsXAxisType);
  readonly scalarSmoothing$ = this.store.select(getMetricsScalarSmoothing);
  showFullSize = false;

  private isScalarCardMetadata(
    cardMetadata: CardMetadata
  ): cardMetadata is ScalarCardMetadata {
    const {plugin} = cardMetadata;
    return plugin === PluginType.SCALARS;
  }

  onFullSizeToggle() {
    this.showFullSize = !this.showFullSize;
    this.fullWidthChanged.emit(this.showFullSize);
    this.fullHeightChanged.emit(this.showFullSize);
  }

  /**
   * Build observables once cardId is defined (after onInit).
   */
  ngOnInit() {
    const selectCardMetadata$ = this.store.select(getCardMetadata, this.cardId);
    const cardMetadata$ = selectCardMetadata$.pipe(
      filter((cardMetadata) => {
        return !!cardMetadata && this.isScalarCardMetadata(cardMetadata);
      }),
      map((cardMetadata) => {
        return cardMetadata as ScalarCardMetadata;
      })
    );

    const settingsAndTimeSeries$ = combineLatest([
      this.store.select(getMetricsXAxisType),
      this.store.select(getCardTimeSeries, this.cardId),
    ]);
    const runIdAndPoints$ = settingsAndTimeSeries$.pipe(
      filter(([xAxisType, runToSeries]) => !!runToSeries),
      map(
        ([xAxisType, runToSeries]) =>
          ({xAxisType, runToSeries} as {
            xAxisType: XAxisType;
            runToSeries: RunToSeries<PluginType.SCALARS>;
          })
      ),
      map(({xAxisType, runToSeries}) => {
        const runIds = Object.keys(runToSeries);
        const results = runIds.map((runId) => {
          return {
            runId,
            points: this.stepSeriesToLineSeries(runToSeries[runId], xAxisType),
          };
        });
        return results;
      })
    );

    this.seriesDataList$ = runIdAndPoints$.pipe(
      switchMap((runIdAndPoints) => {
        if (!runIdAndPoints.length) {
          return of([]);
        }

        return combineLatest(
          runIdAndPoints.map((runIdAndPoint) => {
            return this.getRunDisplayNameAndPoints(runIdAndPoint);
          })
        );
      }),
      combineLatestWith(this.store.select(getCurrentRouteRunSelection)),
      // When the `fetchRunsSucceeded` action fires, the run selection
      // map and the metadata change. To prevent quick fire of changes,
      // debounce by a microtask to emit only single change for the runs
      // store change.
      debounceTime(0),
      map(([result, runSelectionMap]) => {
        return result.map(({runId, displayName, points}) => {
          return {
            seriesId: runId,
            metadata: {displayName},
            points,
            visible: Boolean(runSelectionMap && runSelectionMap.get(runId)),
          };
        });
      }),
      startWith([]),
      distinctUntilChanged(areSeriesDataListEqual),
      shareReplay(1)
    );

    const dataSeriesWithSmoothedData$ = this.seriesDataList$.pipe(
      combineLatestWith(this.store.select(getMetricsScalarSmoothing)),
      switchMap(([seriesDataList, smoothing]) => {
        const seriesWithMetadata = new Map<
          string,
          DataSeries & Omit<ScalarCardSeriesMetadata, 'color'>
        >();

        for (const seriesData of seriesDataList) {
          seriesWithMetadata.set(seriesData.seriesId, {
            id: seriesData.seriesId,
            points: seriesData.points,
            displayName: seriesData.metadata.displayName,
            visible: seriesData.visible,
            smoothOf: null,
            smoothedBy: null,
          });
        }

        if (smoothing === 0) {
          return of(seriesWithMetadata);
        }

        return from(
          classicSmoothing([...seriesWithMetadata.values()], smoothing)
        ).pipe(
          map((smoothedData) => {
            const smoothedDataMap = new Map<string, DataSeries['points']>();
            for (const data of smoothedData) {
              smoothedDataMap.set(data.srcId, data.points);
            }
            const seriesIds = [...seriesWithMetadata.keys()];
            for (const seriesId of seriesIds) {
              const srcSeries = seriesWithMetadata.get(seriesId)!;
              const smoothedSeriesId = JSON.stringify(['smoothed', seriesId]);
              seriesWithMetadata.set(smoothedSeriesId, {
                id: smoothedSeriesId,
                smoothOf: seriesId,
                smoothedBy: null,
                points: smoothedDataMap.get(seriesId)!,
                displayName: srcSeries.displayName,
                visible: srcSeries.visible,
              });

              srcSeries.smoothedBy = smoothedSeriesId;
            }
            return seriesWithMetadata;
          })
        );
      }),
      shareReplay(1)
    );

    this.dataSeries$ = dataSeriesWithSmoothedData$.pipe(
      map((series) => {
        const dataSeries: DataSeries[] = [];
        for (const seriesId of series.keys()) {
          const {id, points} = series.get(seriesId)!;
          dataSeries.push({id, points});
        }
        return dataSeries;
      }),
      startWith([])
    );

    this.chartMetadataMap$ = combineLatest([
      dataSeriesWithSmoothedData$,
      this.store.select(getRunColorMap),
    ]).pipe(
      map(([dataSerieswithSmoothedData, colorMap]) => {
        const metadataMap: DataSeriesMetadataMap<ScalarCardSeriesMetadata> = {};
        for (const [runId, data] of dataSerieswithSmoothedData.entries()) {
          const color = data.smoothOf
            ? colorMap[data.smoothOf]
            : colorMap[runId];

          metadataMap[runId] = {
            id: runId,
            displayName: data.displayName,
            smoothedBy: data.smoothedBy,
            smoothOf: data.smoothOf,
            visible: data.visible,
            color,
            opacity: data.smoothedBy ? 0.4 : 1,
            aux: Boolean(data.smoothedBy),
          } as ScalarCardSeriesMetadata;
        }
        return metadataMap;
      })
    );

    this.colorMap$ = this.store.select(getRunColorMap).pipe(
      map((colorObject) => {
        const colorMap = new Map<string, string>();
        for (const [key, value] of Object.entries(colorObject)) {
          colorMap.set(key, value);
        }
        return colorMap;
      })
    );

    this.loadState$ = this.store.select(getCardLoadState, this.cardId);

    this.tag$ = cardMetadata$.pipe(
      map((cardMetadata) => {
        return cardMetadata.tag;
      })
    );

    this.title$ = this.tag$.pipe(
      map((tag) => {
        return getTagDisplayName(tag, this.groupName);
      })
    );

    this.isPinned$ = this.store.select(getCardPinnedState, this.cardId);
  }

  private getRunDisplayNameAndPoints(runIdAndPoint: {
    runId: string;
    points: SeriesPoint[];
  }): Observable<{runId: string; displayName: string; points: SeriesPoint[]}> {
    const {runId, points} = runIdAndPoint;
    return combineLatest([
      this.store.select(getExperimentIdForRunId, {runId}),
      this.store.select(getExperimentIdToAliasMap),
      this.store.select(getRun, {runId}),
    ]).pipe(
      map(([experimentId, idToAlias, run]) => {
        const displayName = getDisplayNameForRun(
          runId,
          run,
          experimentId ? idToAlias[experimentId] : null
        );
        return {runId, displayName, points};
      })
    );
  }

  private stepSeriesToLineSeries(
    stepSeries: ScalarStepDatum[],
    xAxisType: XAxisType
  ) {
    const isStepBased = xAxisType === XAxisType.STEP;
    return stepSeries.map((stepDatum) => {
      return {
        ...stepDatum,
        x: isStepBased ? stepDatum.step : stepDatum.wallTime,
        y: stepDatum.value,
      };
    });
  }
}
