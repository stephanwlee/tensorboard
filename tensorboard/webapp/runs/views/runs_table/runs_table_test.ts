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
import {OverlayContainer} from '@angular/cdk/overlay';
import {
  Directive,
  EventEmitter,
  Injectable,
  NO_ERRORS_SCHEMA,
  Output,
} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  flushMicrotasks,
  TestBed,
} from '@angular/core/testing';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatMenuModule} from '@angular/material/menu';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Store} from '@ngrx/store';
import {MockStore, provideMockStore} from '@ngrx/store/testing';
import {DataLoadState} from '../../../types/data';
import {of, ReplaySubject} from 'rxjs';

import {State} from '../../../app_state';
import {buildExperiment} from '../../../experiments/store/testing';
import {
  getCurrentRouteRunSelection,
  getExperiment,
  getExperimentIdToAliasMap,
  getExperimentsHparamsAndMetrics,
  getRunColorMap,
  getRunHparamFilterMap,
  getRunMetricFilterMap,
  getRuns,
  getRunSelectorPaginationOption,
  getRunSelectorRegexFilter,
  getRunSelectorSort,
  getRunsLoadState,
} from '../../../selectors';
import {sendKeys} from '../../../testing/dom';
import {MatIconTestingModule} from '../../../testing/mat_icon_module';
import {SortDirection} from '../../../types/ui';
import {RangeInputModule} from '../../../widgets/range_input/range_input_module';
import {
  runColorChanged,
  runDiscreteHparamFilterChanged,
  runIntervalHparamFilterChanged,
  runMetricFilterChanged,
  runPageSelectionToggled,
  runSelectionToggled,
  runSelectorPaginationOptionChanged,
  runSelectorRegexFilterChanged,
  runSelectorSortChanged,
  runsSelectAll,
  runTableShown,
} from '../../actions';
import {DomainType} from '../../data_source/runs_data_source_types';
import {Run} from '../../store/runs_types';
import {
  buildDiscreteFilter,
  buildHparamSpec,
  buildIntervalFilter,
  buildMetricSpec,
  buildRun,
} from '../../store/testing';
import {DiscreteFilter, IntervalFilter} from '../../types';

import {RunsTableComponent} from './runs_table_component';
import {RunsTableContainer, TEST_ONLY} from './runs_table_container';
import {HparamSpec, MetricSpec, RunsTableColumn} from './types';

@Injectable()
class ColorPickerTestHelper {
  private readonly onColorPickerChanges: Array<(color: string) => void> = [];

  /**
   * Triggers `colorPickerChange` on the TestableColorPicker. Since the
   * ColorPicker does not know about `run` and there can be many instances of
   * the picker, we use index of registered components.
   */
  triggerColorPickerChangeForTest(index: number, newColor: string) {
    if (!this.onColorPickerChanges[index]) {
      throw new Error(
        'Expected `internalSetOnColorPickerChange` to have been ' +
          'called before calling `triggerColorPickerChangeForTest`.'
      );
    }
    this.onColorPickerChanges[index](newColor);
  }

  internalSetOnColorPickerChange(callback: (color: string) => void) {
    this.onColorPickerChanges.push(callback);
  }
}

/**
 * ColorPickerModule is not provider in test due to template compilation issue.
 * This provides very simple version that can trigger changed event
 * programmatically.
 */
@Directive({
  selector: '[colorPicker]',
})
class TestableColorPicker {
  @Output() colorPickerChange = new EventEmitter<string>();
  constructor(testHelper: ColorPickerTestHelper) {
    testHelper.internalSetOnColorPickerChange((color: string) => {
      this.colorPickerChange.emit(color);
    });
  }
}

describe('runs_table', () => {
  let store: MockStore<State>;
  let dispatchSpy: jasmine.Spy;
  let overlayContainer: OverlayContainer;

  function createComponent(
    experimentIds: string[],
    columns?: RunsTableColumn[],
    usePagination?: boolean
  ) {
    const fixture = TestBed.createComponent(RunsTableContainer);
    fixture.componentInstance.experimentIds = experimentIds;
    if (columns) {
      fixture.componentInstance.columns = columns;
    }
    fixture.componentInstance.usePagination = usePagination;
    fixture.detectChanges();

    return fixture;
  }

  function getTableRowTextContent(
    fixture: ComponentFixture<RunsTableContainer>
  ) {
    const rows = [...fixture.nativeElement.querySelectorAll('tbody tr')];
    return rows.map((row) => {
      const columns = [...row.querySelectorAll('td')];
      return columns.map((column) => column.textContent.trim());
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatCheckboxModule,
        MatIconTestingModule,
        MatMenuModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatSortModule,
        MatTableModule,
        NoopAnimationsModule,
        RangeInputModule,
      ],
      declarations: [
        RunsTableComponent,
        RunsTableContainer,
        RunsTableContainer,
        TestableColorPicker,
      ],
      providers: [provideMockStore(), ColorPickerTestHelper],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    store = TestBed.inject<Store<State>>(Store) as MockStore<State>;
    store.overrideSelector(getRuns, []);
    store.overrideSelector(getRunsLoadState, {
      state: DataLoadState.NOT_LOADED,
      lastLoadedTimeInMs: null,
    });
    store.overrideSelector(getExperiment, null);
    store.overrideSelector(getCurrentRouteRunSelection, new Map());
    store.overrideSelector(getRunSelectorPaginationOption, {
      pageIndex: 0,
      pageSize: 10,
    });
    store.overrideSelector(getRunSelectorRegexFilter, '');
    store.overrideSelector(getRunSelectorSort, {
      column: null,
      direction: SortDirection.UNSET,
    });
    store.overrideSelector(getRunColorMap, {});
    store.overrideSelector(getExperimentIdToAliasMap, {
      rowling: 'Harry Potter',
      tolkien: 'The Lord of the Rings',
    });
    store.overrideSelector(getRunHparamFilterMap, new Map());
    store.overrideSelector(getRunMetricFilterMap, new Map());
    store.overrideSelector(getExperimentsHparamsAndMetrics, {
      hparams: [],
      metrics: [],
    });
    dispatchSpy = spyOn(store, 'dispatch');
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  describe('list renders', () => {
    let selectSpy: jasmine.Spy;

    beforeEach(() => {
      // To make sure we only return the runs when called with the right props.
      selectSpy = spyOn(store, 'select').and.callThrough();
    });

    it('renders list of runs in a table', async () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'book'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      selectSpy.withArgs(getExperiment, {experimentId: 'book'}).and.returnValue(
        of(
          buildExperiment({
            name: 'Harry Potter',
          })
        )
      );
      store.overrideSelector(getExperimentIdToAliasMap, {book: 'Harry Potter'});

      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // mat-table's content somehow does not end up in DebugElement.
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);

      const [book1, book2] = rows;
      expect(
        [...book1.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['Harry Potter', "The Philosopher's Stone"]);

      expect(
        [...book2.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['Harry Potter', 'The Chamber Of Secrets']);
    });

    it('dispatches `runTableShown` when shown', () => {
      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      expect(dispatchSpy).toHaveBeenCalledWith(
        runTableShown({
          experimentIds: ['book'],
        })
      );
    });

    it('concats runs from multiple experimentIds into the table', async () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'rowling'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'tolkien'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'tolkien'})
        .and.returnValue(
          of([buildRun({id: 'book3', name: 'The Fellowship of the Ring'})])
        );
      selectSpy
        .withArgs(getExperiment, {experimentId: 'rowling'})
        .and.returnValue(
          of(
            buildExperiment({
              name: 'Harry Potter',
            })
          )
        );
      selectSpy
        .withArgs(getExperiment, {experimentId: 'tolkien'})
        .and.returnValue(
          of(
            buildExperiment({
              name: 'The Lord of the Rings',
            })
          )
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'HP',
        tolkien: 'LoTR',
      });

      const fixture = createComponent(
        ['tolkien', 'rowling'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // mat-table's content somehow does not end up in DebugElement.
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);

      const [book1, book2, book3] = rows;
      expect(
        [...book1.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['LoTR', 'The Fellowship of the Ring']);
      expect(
        [...book2.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['HP', "The Philosopher's Stone"]);
      expect(
        [...book3.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['HP', 'The Chamber Of Secrets']);
    });

    it('honors the order of `columns` when rendering', async () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'book'})
        .and.returnValue(
          of([buildRun({id: 'book1', name: 'The Fellowship of the Ring'})])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        book: 'The Lord of the Rings',
      });
      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.RUN_NAME, RunsTableColumn.EXPERIMENT_NAME]
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // mat-table's content somehow does not end up in DebugElement.
      const [book1] = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(
        [...book1.querySelectorAll('td')].map((node) => node.textContent)
      ).toEqual(['The Fellowship of the Ring', 'The Lord of the Rings']);
    });

    it('updates the list of runs', async () => {
      // To make sure we only return the runs when called with the right props.
      const runs = new ReplaySubject<Run[]>(1);
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy.withArgs(getRuns, {experimentId: 'book'}).and.returnValue(runs);

      runs.next([
        buildRun({id: 'Harry', name: 'Harry'}),
        buildRun({id: 'Potter', name: 'Potter'}),
      ]);
      const fixture = createComponent(['book']);
      fixture.detectChanges();
      await fixture.whenStable();

      const rowsBefore = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rowsBefore.length).toBe(2);

      runs.next([buildRun({id: 'Potter', name: 'Potter'})]);
      fixture.detectChanges();

      const rowsAfter = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rowsAfter.length).toBe(1);
      const [potter] = rowsAfter;
      expect(potter.querySelector('td').textContent).toBe('Potter');
    });

    it('renders checkboxes according to the map', async () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'book'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      selectSpy.withArgs(getCurrentRouteRunSelection).and.returnValue(
        of(
          new Map([
            ['book1', true],
            ['book2', false],
          ])
        )
      );

      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // mat-table's content somehow does not end up in DebugElement.
      const [book1, book2] = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(book1.querySelector('mat-checkbox input').checked).toBe(true);
      expect(book2.querySelector('mat-checkbox input').checked).toBe(false);
    });

    it('renders run colors', () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'book'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        book: "The Philosopher's Stone",
      });
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', false],
        ])
      );
      store.overrideSelector(getRunColorMap, {
        book1: '#000',
      });

      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.RUN_NAME, RunsTableColumn.RUN_COLOR]
      );
      fixture.detectChanges();

      const [book1, book2] = fixture.nativeElement.querySelectorAll('tbody tr');
      const [book1Name, book1Color] = book1.querySelectorAll('td');
      expect(book1Name.textContent).toBe("The Philosopher's Stone");
      expect(book1Color.querySelector('button').style.background).toBe(
        'rgb(0, 0, 0)'
      );
      expect(
        book1Color.querySelector('button').classList.contains('no-color')
      ).toBe(false);

      const [book2Name, book2Color] = book2.querySelectorAll('td');
      expect(book2Name.textContent).toBe('The Chamber Of Secrets');
      expect(book2Color.querySelector('button').style.background).toBe('');
      expect(
        book2Color.querySelector('button').classList.contains('no-color')
      ).toBe(true);
    });

    it('dispatches `runColorChanged` when color changes', () => {
      const testHelper = TestBed.inject(ColorPickerTestHelper);
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, {experimentId: 'book'})
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'book'})
        .and.returnValue(of([buildRun({id: 'book1', name: 'Book name'})]));
      store.overrideSelector(getRunColorMap, {
        book1: '#000',
      });

      const fixture = createComponent(
        ['book'],
        [RunsTableColumn.RUN_NAME, RunsTableColumn.RUN_COLOR]
      );
      fixture.detectChanges();

      testHelper.triggerColorPickerChangeForTest(0, '#ccc');
      expect(dispatchSpy).toHaveBeenCalledWith(
        runColorChanged({
          runId: 'book1',
          newColor: '#ccc',
        })
      );
    });
  });

  describe('loading', () => {
    it('renders loading indicator when at least one content is loading', () => {
      const selectSpy = spyOn(store, 'select');
      selectSpy.and.callThrough();
      selectSpy
        .withArgs(getRunsLoadState, {experimentId: 'book'})
        .and.returnValue(
          of({state: DataLoadState.LOADING, lastLoadedTimeInMs: null})
        );
      selectSpy
        .withArgs(getRunsLoadState, {experimentId: 'movie'})
        .and.returnValue(
          of({state: DataLoadState.LOADED, lastLoadedTimeInMs: 0})
        );

      const fixture = createComponent(['book', 'movie']);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeDefined();
    });

    it('does not render spinner when everything is loaded', () => {
      const selectSpy = spyOn(store, 'select');
      selectSpy.and.callThrough();
      selectSpy
        .withArgs(getRunsLoadState, {experimentId: 'book'})
        .and.returnValue(
          of({state: DataLoadState.LOADED, lastLoadedTimeInMs: 0})
        );
      selectSpy
        .withArgs(getRunsLoadState, {experimentId: 'movie'})
        .and.returnValue(
          of({state: DataLoadState.LOADED, lastLoadedTimeInMs: 0})
        );

      const fixture = createComponent(['book', 'movie']);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('mat-spinner'));
      expect(spinner).toBeNull();
    });
  });

  describe('empty', () => {
    it('does not render no runs text when content is loading', () => {
      store.overrideSelector(getRunsLoadState, {
        state: DataLoadState.LOADING,
        lastLoadedTimeInMs: null,
      });
      store.overrideSelector(getRuns, []);
      const fixture = createComponent(['book']);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('no-runs'));
      expect(spinner).toBeNull();
    });

    it('renders no runs when content is loading', () => {
      store.overrideSelector(getRunsLoadState, {
        state: DataLoadState.LOADING,
        lastLoadedTimeInMs: null,
      });
      store.overrideSelector(getRuns, []);
      const fixture = createComponent(['book']);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('no-runs'));
      expect(spinner).toBeDefined();
    });
  });

  describe('paginator', () => {
    /**
     * Updates the mat-table and mat-paginator. Must be called inside a
     * fakeAsync.
     *
     * 1. detectChanges causes mat-table to update which...
     * 2. triggers Promise.resolve to update the mat-paginator in the
     *    table-data-source [1]. So we use flushMicroTask to synchronously
     *    resolve the promise. It marks the paginator dirty, so...
     * 3. detectChanges to check for dirty DOM and update the paginator.
     * [1]:
     * https://github.com/angular/components/blob/master/src/material/table/table-data-source.ts#L301
     */
    function updateTableAndPaginator(
      fixture: ComponentFixture<RunsTableContainer>
    ) {
      fixture.detectChanges();
      flushMicrotasks();
      fixture.detectChanges();
    }

    function createAndSetRuns(numberOfRuns: number) {
      const runs = Array.from<Run>({length: numberOfRuns}).map(
        (notUsed, index) => {
          const name = `run_${index}`;
          return buildRun({
            id: name,
            name,
          });
        }
      );
      store.overrideSelector(getRuns, runs);
    }

    beforeEach(() => {
      // Limit the page size to 5.
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 5,
      });
    });

    it('shows all items without pagination by default', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      createAndSetRuns(5);
      const fixture = createComponent(['book']);
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
      expect(
        fixture.debugElement.query(By.css('mat-paginator'))
      ).not.toBeTruthy();
      expect(getTableRowTextContent(fixture)).toEqual([
        ['run_0'],
        ['run_1'],
        ['run_2'],
        ['run_3'],
        ['run_4'],
      ]);
    });

    it('displays the correct text on the paginator', () => {
      const fixture = createComponent(
        ['book'],
        undefined,
        true /* usePagination */
      );
      fixture.detectChanges();

      const label = fixture.debugElement.query(
        By.css('.mat-paginator-page-size-label')
      );
      expect(label.nativeElement.textContent).toContain('Show runs:');
    });

    it('fires action when pressing next, last, first button', fakeAsync(() => {
      const PAGE_SIZE = 5;
      const NUM_PAGES = 4;
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 1,
        pageSize: PAGE_SIZE,
      });
      createAndSetRuns(PAGE_SIZE * NUM_PAGES);
      const fixture = createComponent(
        ['book'],
        undefined,
        true /* usePagination */
      );
      updateTableAndPaginator(fixture);

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      // By default, mat-paginator take the lowest pageSizeOptions.
      expect(rows.length).toBe(PAGE_SIZE);
      const [beforeFirstEl] = rows;
      expect(beforeFirstEl.querySelector('td').textContent).toBe('run_5');

      fixture.debugElement
        .query(By.css('[aria-label="Next page"]'))
        .nativeElement.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorPaginationOptionChanged({
          pageIndex: 2,
          pageSize: PAGE_SIZE,
        })
      );

      fixture.debugElement
        .query(By.css('[aria-label="Last page"]'))
        .nativeElement.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorPaginationOptionChanged({
          // index starts from 0.
          pageIndex: NUM_PAGES - 1,
          pageSize: PAGE_SIZE,
        })
      );

      fixture.debugElement
        .query(By.css('[aria-label="First page"]'))
        .nativeElement.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorPaginationOptionChanged({
          pageIndex: 0,
          pageSize: PAGE_SIZE,
        })
      );
    }));

    it('shows content from other pages', fakeAsync(() => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 5,
      });
      createAndSetRuns(20);
      const fixture = createComponent(
        ['book'],
        undefined,
        true /* usePagination */
      );
      updateTableAndPaginator(fixture);

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      // By default, mat-paginator take the lowest pageSizeOptions.
      expect(rows.length).toBe(5);
      const [beforeFirstEl] = rows;
      expect(beforeFirstEl.querySelector('td').textContent).toBe('run_0');

      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 1,
        pageSize: 5,
      });
      store.refreshState();
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['run_5'],
        ['run_6'],
        ['run_7'],
        ['run_8'],
        ['run_9'],
      ]);
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 1,
        pageSize: 3,
      });
      store.refreshState();
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['run_3'],
        ['run_4'],
        ['run_5'],
      ]);
    }));

    it('shows correct number of items when filtering', fakeAsync(() => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 1,
        pageSize: 5,
      });
      store.overrideSelector(getRunSelectorRegexFilter, 'run_[0-9]$');
      createAndSetRuns(20);
      const fixture = createComponent(
        ['book'],
        undefined,
        true /* usePagination */
      );
      updateTableAndPaginator(fixture);

      const label = fixture.nativeElement.querySelector(
        '.mat-paginator-range-label'
      );
      // By default, mat-paginator take the lowest pageSizeOptions.
      expect(label.textContent).toContain('6 – 10 of 10');

      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 5,
      });
      store.overrideSelector(getRunSelectorRegexFilter, 'run_[4-6]');
      store.refreshState();
      updateTableAndPaginator(fixture);

      expect(label.textContent).toContain('1 – 3 of 3');
    }));
  });

  describe('sort', () => {
    let selectSpy: jasmine.Spy;

    beforeEach(() => {
      // To make sure we only return the runs when called with the right props.
      selectSpy = spyOn(store, 'select').and.callThrough();
    });

    it('dispatches action when sorting', () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, jasmine.any)
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      const [expButton, runButton] = fixture.nativeElement.querySelectorAll(
        'th .mat-sort-header-container'
      );

      expButton.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorSortChanged({
          column: 'experiment_name',
          direction: SortDirection.ASC,
        })
      );

      runButton.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorSortChanged({
          column: 'run_name',
          direction: SortDirection.ASC,
        })
      );
    });

    it('sorts by experiment name', () => {
      const sortSubject = new ReplaySubject<{
        column: RunsTableColumn;
        direction: SortDirection;
      }>(1);
      sortSubject.next({
        column: RunsTableColumn.EXPERIMENT_NAME,
        direction: SortDirection.UNSET,
      });
      selectSpy.withArgs(getRunSelectorSort).and.returnValue(sortSubject);
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, jasmine.any)
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
        tolkien: 'The Lord of the Rings',
      });
      selectSpy
        .withArgs(getRuns, {experimentId: 'tolkien'})
        .and.returnValue(
          of([buildRun({id: 'book3', name: 'The Fellowship of the Ring'})])
        );

      const fixture = createComponent(
        ['rowling', 'tolkien'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Harry Potter', "The Philosopher's Stone"],
        ['Harry Potter', 'The Chamber Of Secrets'],
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
      ]);

      sortSubject.next({
        column: RunsTableColumn.EXPERIMENT_NAME,
        direction: SortDirection.ASC,
      });
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Harry Potter', 'The Chamber Of Secrets'],
        ['Harry Potter', "The Philosopher's Stone"],
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
      ]);

      sortSubject.next({
        column: RunsTableColumn.EXPERIMENT_NAME,
        direction: SortDirection.DESC,
      });
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
        ['Harry Potter', "The Philosopher's Stone"],
        ['Harry Potter', 'The Chamber Of Secrets'],
      ]);
    });

    it('sorts by run name', () => {
      const sortSubject = new ReplaySubject<{
        column: RunsTableColumn;
        direction: SortDirection;
      }>(1);
      sortSubject.next({
        column: RunsTableColumn.RUN_NAME,
        direction: SortDirection.UNSET,
      });
      selectSpy.withArgs(getRunSelectorSort).and.returnValue(sortSubject);
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, jasmine.any)
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
            buildRun({id: 'book3', name: "The Philosopher's Stone"}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
        tolkien: 'The Lord of the Rings',
      });
      selectSpy
        .withArgs(getRuns, {experimentId: 'tolkien'})
        .and.returnValue(
          of([buildRun({id: 'book3', name: 'The Fellowship of the Ring'})])
        );

      const fixture = createComponent(
        ['rowling', 'tolkien'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Harry Potter', "The Philosopher's Stone"],
        ['Harry Potter', 'The Chamber Of Secrets'],
        ['Harry Potter', "The Philosopher's Stone"],
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
      ]);

      sortSubject.next({
        column: RunsTableColumn.RUN_NAME,
        direction: SortDirection.ASC,
      });
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Harry Potter', 'The Chamber Of Secrets'],
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
        ['Harry Potter', "The Philosopher's Stone"],
        ['Harry Potter', "The Philosopher's Stone"],
      ]);

      sortSubject.next({
        column: RunsTableColumn.RUN_NAME,
        direction: SortDirection.DESC,
      });
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Harry Potter', "The Philosopher's Stone"],
        ['Harry Potter', "The Philosopher's Stone"],
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
        ['Harry Potter', 'The Chamber Of Secrets'],
      ]);
    });
  });

  describe('regex filtering', () => {
    let selectSpy: jasmine.Spy;

    beforeEach(() => {
      // To make sure we only return the runs when called with the right props.
      selectSpy = spyOn(store, 'select').and.callThrough();
    });

    [
      {
        regexString: '',
        expectedTableContent: [
          ['Harry Potter', "The Philosopher's Stone"],
          ['Harry Potter', 'The Chamber Of Secrets'],
          ['The Lord of the Rings', 'The Fellowship of the Ring'],
          ['The Lord of the Rings', 'The Silmarillion'],
        ],
      },
      {
        regexString: '.*',
        expectedTableContent: [
          ['Harry Potter', "The Philosopher's Stone"],
          ['Harry Potter', 'The Chamber Of Secrets'],
          ['The Lord of the Rings', 'The Fellowship of the Ring'],
          ['The Lord of the Rings', 'The Silmarillion'],
        ],
      },
      {
        regexString: '.+arr',
        expectedTableContent: [
          ['Harry Potter', "The Philosopher's Stone"],
          ['Harry Potter', 'The Chamber Of Secrets'],
        ],
      },
      {
        regexString: 'mar',
        expectedTableContent: [['The Lord of the Rings', 'The Silmarillion']],
      },
      {
        regexString: '[m,H]ar',
        expectedTableContent: [
          ['Harry Potter', "The Philosopher's Stone"],
          ['Harry Potter', 'The Chamber Of Secrets'],
          ['The Lord of the Rings', 'The Silmarillion'],
        ],
      },
    ].forEach(({regexString, expectedTableContent}) => {
      it(`filters with regex string: ${regexString}`, () => {
        const filterSubject = new ReplaySubject<string>(1);
        filterSubject.next('');
        selectSpy
          .withArgs(getRunSelectorRegexFilter)
          .and.returnValue(filterSubject);
        selectSpy
          .withArgs(TEST_ONLY.getRunsLoading, jasmine.any)
          .and.returnValue(of(false));
        selectSpy
          .withArgs(getRuns, {experimentId: 'rowling'})
          .and.returnValue(
            of([
              buildRun({id: 'book1', name: "The Philosopher's Stone"}),
              buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
            ])
          );
        store.overrideSelector(getExperimentIdToAliasMap, {
          rowling: 'Harry Potter',
          tolkien: 'The Lord of the Rings',
        });
        selectSpy
          .withArgs(getRuns, {experimentId: 'tolkien'})
          .and.returnValue(
            of([
              buildRun({id: 'book3', name: 'The Fellowship of the Ring'}),
              buildRun({id: 'book4', name: 'The Silmarillion'}),
            ])
          );

        filterSubject.next(regexString);

        const fixture = createComponent(
          ['rowling', 'tolkien'],
          [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
        );
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual(expectedTableContent);
      });
    });

    it('filters only by run name when experiment column is omitted', () => {
      selectSpy
        .withArgs(TEST_ONLY.getRunsLoading, jasmine.any)
        .and.returnValue(of(false));
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      selectSpy
        .withArgs(getRuns, {experimentId: 'tolkien'})
        .and.returnValue(
          of([
            buildRun({id: 'book3', name: 'The Fellowship of the Ring'}),
            buildRun({id: 'book4', name: 'The Silmarillion'}),
          ])
        );
      // If experiment name were to be matched, it would match "Lord".
      store.overrideSelector(getRunSelectorRegexFilter, 'o\\w*r');

      const fixture = createComponent(
        ['rowling', 'tolkien'],
        [RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ["The Philosopher's Stone"],
      ]);
    });

    it('does not break app when regex string is illegal RegExp', () => {
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      selectSpy
        .withArgs(getRuns, {experimentId: 'tolkien'})
        .and.returnValue(
          of([
            buildRun({id: 'book3', name: 'The Fellowship of the Ring'}),
            buildRun({id: 'book4', name: 'The Silmarillion'}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
        tolkien: 'The Lord of the Rings',
      });

      // Square bracket needs to be closed.
      store.overrideSelector(getRunSelectorRegexFilter, '[The Fellow');

      const fixture = createComponent(
        ['rowling', 'tolkien'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      // Renders an empty table when there is an error.
      expect(getTableRowTextContent(fixture)).toEqual([]);

      // Test the update afterwards and see if it works.
      store.overrideSelector(getRunSelectorRegexFilter, 'The Fellow');
      store.refreshState();
      fixture.detectChanges();

      expect(getTableRowTextContent(fixture)).toEqual([
        ['The Lord of the Rings', 'The Fellowship of the Ring'],
      ]);
    });

    it('does not render select all when no items match the regex', () => {
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
      });

      store.overrideSelector(getRunSelectorRegexFilter, 'YOUWILLNOTMATCHME');

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      // Renders an empty table when there is an error.
      expect(getTableRowTextContent(fixture)).toEqual([]);

      expect(
        fixture.nativeElement.querySelector('.show-select-all')
      ).toBeNull();
    });

    it('dispatches action when user types on the input field', () => {
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );

      // Square bracket needs to be closed.
      store.overrideSelector(getRunSelectorRegexFilter, '[The Fellow');

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      sendKeys(fixture, fixture.debugElement.query(By.css('input')), 'hA');

      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectorRegexFilterChanged({
          regexString: 'hA',
        })
      );
    });

    it('shows no match string when regex does not match any item', () => {
      selectSpy
        .withArgs(getRuns, {experimentId: 'rowling'})
        .and.returnValue(
          of([
            buildRun({id: 'book1', name: "The Philosopher's Stone"}),
            buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          ])
        );
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
      });

      store.overrideSelector(getRunSelectorRegexFilter, 'DO_NOT_MATCH');

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.EXPERIMENT_NAME, RunsTableColumn.RUN_NAME]
      );
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css('.no-runs')).nativeElement.textContent
      ).toContain('No runs match "DO_NOT_MATCH"');
    });
  });

  describe('checkbox', () => {
    it('renders header checkbox as check when all items in a page are selected', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      // pageSize is 2 so book3 is out of current page.
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', true],
          ['book3', false],
        ])
      );
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(getExperimentIdToAliasMap, {
        rowling: 'Harry Potter',
      });

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'thead mat-checkbox'
      );

      expect(checkbox.classList.contains('mat-checkbox-checked')).toBe(true);
    });

    it(
      'renders header checkbox as a line when partial items in a page are ' +
        'selected',
      async () => {
        store.overrideSelector(getRunSelectorPaginationOption, {
          pageIndex: 0,
          pageSize: 2,
        });
        store.overrideSelector(
          getCurrentRouteRunSelection,
          new Map([
            ['book1', true],
            ['book2', false],
            ['book3', true],
          ])
        );
        store.overrideSelector(getRuns, [
          buildRun({id: 'book1', name: "The Philosopher's Stone"}),
          buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
        ]);

        const fixture = createComponent(
          ['rowling'],
          [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
          true /* usePagination */
        );
        fixture.detectChanges();

        const checkbox = fixture.nativeElement.querySelector(
          'thead mat-checkbox'
        );

        expect(checkbox.classList.contains('mat-checkbox-indeterminate')).toBe(
          true
        );
      }
    );

    it('dispatches runSelectionToggled on checkbox click', async () => {
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();
      await fixture.whenStable();

      // mat-table's content somehow does not end up in DebugElement.
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      const [book1, book2] = rows;
      book2.querySelector('td mat-checkbox input').click();
      book1.querySelector('td mat-checkbox input').click();

      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectionToggled({
          experimentIds: ['rowling'],
          runId: 'book2',
        })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        runSelectionToggled({
          experimentIds: ['rowling'],
          runId: 'book1',
        })
      );
    });

    it(
      'dispatches runPageSelectionToggled with current page when click on ' +
        'header',
      () => {
        store.overrideSelector(getRunSelectorPaginationOption, {
          pageIndex: 0,
          pageSize: 2,
        });
        store.overrideSelector(getRuns, [
          buildRun({id: 'book1', name: "The Philosopher's Stone"}),
          buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
          buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
        ]);

        const fixture = createComponent(
          ['rowling'],
          [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
          true /* usePagination */
        );
        fixture.detectChanges();

        fixture.nativeElement.querySelector('thead mat-checkbox input').click();

        expect(dispatchSpy).toHaveBeenCalledWith(
          runPageSelectionToggled({
            experimentIds: ['rowling'],
            runIds: ['book1', 'book2'],
          })
        );
      }
    );

    it('does not render select all button when pagination is disabled', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', true],
          ['book3', false],
        ])
      );

      const fixture = createComponent(
        ['tolkien'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        false /* usePagination */
      );
      fixture.detectChanges();

      const showAll = fixture.nativeElement.querySelector(
        '.select-all.show-select-all'
      );
      expect(showAll).not.toBeTruthy();
    });

    it('renders select all button when page is selected but not all items', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', true],
          ['book3', false],
        ])
      );

      const fixture = createComponent(
        ['tolkien'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const showAll = fixture.nativeElement.querySelector(
        '.select-all.show-select-all'
      );
      expect(showAll.textContent).toContain(
        'All runs in this page are selected but not all runs (2 of 3)'
      );
    });

    it('does not render select if everything is selected', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', true],
          ['book3', true],
        ])
      );

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const showAll = fixture.nativeElement.querySelector(
        '.select-all.show-select-all'
      );
      expect(showAll).toBeNull();
    });

    it('does not render select all if page is not all selected', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', false],
          ['book3', true],
        ])
      );

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const showAll = fixture.nativeElement.querySelector(
        '.select-all.show-select-all'
      );
      expect(showAll).toBeNull();
    });

    it('renders select all even when all filtered items are selected', () => {
      store.overrideSelector(getRunSelectorRegexFilter, '[oO]f');
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', false],
          ['book2', true],
          ['book3', true],
        ])
      );

      const fixture = createComponent(
        ['tolkien'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const showAll = fixture.nativeElement.querySelector(
        '.select-all.show-select-all'
      );
      expect(showAll.textContent).toContain(
        'All runs in this page are selected but not all runs (2 of 3)'
      );
    });

    it('dispatches runsSelectAll when click on select', () => {
      store.overrideSelector(getRunSelectorPaginationOption, {
        pageIndex: 0,
        pageSize: 2,
      });
      store.overrideSelector(getRuns, [
        buildRun({id: 'book1', name: "The Philosopher's Stone"}),
        buildRun({id: 'book2', name: 'The Chamber Of Secrets'}),
        buildRun({id: 'book3', name: 'The Prisoner of Azkaban'}),
      ]);
      store.overrideSelector(
        getCurrentRouteRunSelection,
        new Map([
          ['book1', true],
          ['book2', true],
          ['book3', false],
        ])
      );

      const fixture = createComponent(
        ['rowling'],
        [RunsTableColumn.CHECKBOX, RunsTableColumn.RUN_NAME],
        true /* usePagination */
      );
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.select-all button');
      button.click();

      expect(dispatchSpy).toHaveBeenCalledWith(
        runsSelectAll({
          experimentIds: ['rowling'],
        })
      );
    });
  });

  describe('hparams and metrics', () => {
    function createComponent(
      hparamSpecs: HparamSpec[],
      metricSpecs: MetricSpec[],
      showHparamsAndMetrics = true
    ) {
      store.overrideSelector(getExperimentsHparamsAndMetrics, {
        hparams: hparamSpecs,
        metrics: metricSpecs,
      });
      store.overrideSelector(getExperimentIdToAliasMap, {library: 'Library'});
      const fixture = TestBed.createComponent(RunsTableContainer);
      fixture.componentInstance.experimentIds = ['library'];
      fixture.componentInstance.showHparamsAndMetrics = showHparamsAndMetrics;
      fixture.detectChanges();
      return fixture;
    }

    it('renders hparams and metrics when they exist', () => {
      const hparamSpecs = [
        buildHparamSpec({
          name: 'batch_size',
          displayName: 'Batch size',
          domain: {type: DomainType.INTERVAL, minValue: 16, maxValue: 128},
        }),
        buildHparamSpec({
          name: 'dropout',
          displayName: '',
          domain: {type: DomainType.INTERVAL, minValue: 0.3, maxValue: 0.8},
        }),
      ];
      const metricSpecs = [
        buildMetricSpec({tag: 'acc', displayName: 'Accuracy'}),
        buildMetricSpec({tag: 'loss', displayName: ''}),
      ];
      store.overrideSelector(
        getRunHparamFilterMap,
        new Map([
          [
            'batch_size',
            buildIntervalFilter({filterLowerValue: 16, filterUpperValue: 128}),
          ],
          [
            'dropout',
            buildIntervalFilter({filterLowerValue: 0.3, filterUpperValue: 0.8}),
          ],
        ])
      );
      store.overrideSelector(
        getRunMetricFilterMap,
        new Map([
          [
            'acc',
            buildIntervalFilter({
              includeUndefined: true,
              filterLowerValue: 0,
              filterUpperValue: 1,
            }),
          ],
          [
            'loss',
            buildIntervalFilter({
              includeUndefined: true,
              filterLowerValue: 0,
              filterUpperValue: 1,
            }),
          ],
        ])
      );
      store.overrideSelector(getRuns, [
        buildRun({
          id: 'book1',
          name: 'Book 1',
          hparams: [{name: 'batch_size', value: 32}],
        }),
        buildRun({
          id: 'book2',
          name: 'Book 2',
          hparams: [
            {name: 'batch_size', value: 128},
            {name: 'dropout', value: 0.3},
          ],
          metrics: [{tag: 'acc', value: 0.91}],
        }),
        buildRun({
          id: 'book3',
          name: 'Book 3',
          metrics: [
            {tag: 'acc', value: 0.7},
            {tag: 'loss', value: 0},
          ],
        }),
      ]);

      const fixture = createComponent(hparamSpecs, metricSpecs);
      const columnHeaders = fixture.nativeElement.querySelectorAll(
        '.columns th .name'
      );
      expect([...columnHeaders].map((header) => header.textContent)).toEqual([
        'Batch size',
        'dropout',
        'Accuracy',
        'loss',
      ]);

      expect(getTableRowTextContent(fixture)).toEqual([
        ['Book 1', '32', '', '', ''],
        ['Book 2', '128', '0.3', '0.91', ''],
        ['Book 3', '', '', '0.7', '0'],
      ]);
    });

    describe('filtering', () => {
      let TEST_HPARAM_SPECS: HparamSpec[];
      let TEST_METRIC_SPECS: MetricSpec[];

      function buildHparamFilterMap(
        otherValues: Array<[string, IntervalFilter | DiscreteFilter]> = []
      ): Map<string, IntervalFilter | DiscreteFilter> {
        return new Map([
          [
            'batch_size',
            buildIntervalFilter({filterLowerValue: 16, filterUpperValue: 128}),
          ],
          [
            'qaz',
            buildIntervalFilter({filterLowerValue: 0.3, filterUpperValue: 0.8}),
          ],
          ['foo', buildDiscreteFilter({filterValues: ['faz', 'bar']})],
          ...otherValues,
        ]);
      }

      function buildMetricFilterMap(
        otherValues: Array<[string, IntervalFilter]> = []
      ): Map<string, IntervalFilter> {
        return new Map([
          [
            'acc',
            buildIntervalFilter({filterLowerValue: 0, filterUpperValue: 1}),
          ],
          [
            'loss',
            buildIntervalFilter({filterLowerValue: 0.5, filterUpperValue: 1}),
          ],
          ...otherValues,
        ]);
      }

      beforeEach(() => {
        TEST_HPARAM_SPECS = [
          buildHparamSpec({
            name: 'batch_size',
            displayName: 'Batch size',
            domain: {type: DomainType.INTERVAL, minValue: 16, maxValue: 128},
          }),
          buildHparamSpec({
            name: 'qaz',
            displayName: '',
            domain: {type: DomainType.INTERVAL, minValue: 0.3, maxValue: 0.8},
          }),
          buildHparamSpec({
            name: 'foo',
            displayName: '',
            domain: {type: DomainType.DISCRETE, values: ['faz', 'bar', 'baz']},
          }),
        ];
        TEST_METRIC_SPECS = [
          buildMetricSpec({tag: 'acc', displayName: 'Accuracy'}),
          buildMetricSpec({tag: 'loss', displayName: ''}),
        ];
        store.overrideSelector(getRunHparamFilterMap, buildHparamFilterMap());
        store.overrideSelector(getRunMetricFilterMap, buildMetricFilterMap());
      });

      it('filters by discrete hparams', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            hparams: [{name: 'foo', value: 'bar'}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            hparams: [{name: 'foo', value: 'baz'}],
          }),
          buildRun({
            id: 'id3',
            name: 'Book 3',
            hparams: [{name: 'foo', value: 'faz'}],
          }),
          buildRun({id: 'id4', name: 'Book 4', hparams: []}),
        ]);
        store.overrideSelector(
          getRunHparamFilterMap,
          buildHparamFilterMap([
            [
              'foo',
              buildDiscreteFilter({
                includeUndefined: false,
                filterValues: ['bar', 'faz'],
              }),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 1', '', '', 'bar', '', ''],
          ['Book 3', '', '', 'faz', '', ''],
        ]);
      });

      it('allows filter for only undefined hparam value', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            hparams: [{name: 'foo', value: 'bar'}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            hparams: [{name: 'foo', value: 'baz'}],
          }),
          buildRun({id: 'id3', name: 'Book 3', hparams: []}),
          buildRun({id: 'id4', name: 'Book 4', hparams: []}),
        ]);
        store.overrideSelector(
          getRunHparamFilterMap,
          buildHparamFilterMap([
            [
              'foo',
              buildDiscreteFilter({includeUndefined: true, filterValues: []}),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 3', '', '', '', '', ''],
          ['Book 4', '', '', '', '', ''],
        ]);
      });

      it('filters by interval hparams', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            hparams: [{name: 'qaz', value: 0.5}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            hparams: [{name: 'qaz', value: 1}],
          }),
          buildRun({
            id: 'id3',
            name: 'Book 3',
            hparams: [{name: 'qaz', value: 0}],
          }),
          buildRun({id: 'id4', name: 'Book 4', hparams: []}),
        ]);
        store.overrideSelector(
          getRunHparamFilterMap,
          buildHparamFilterMap([
            [
              'qaz',
              buildIntervalFilter({
                includeUndefined: false,
                filterLowerValue: 0.4,
                filterUpperValue: 1,
              }),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 1', '', '0.5', '', '', ''],
          ['Book 2', '', '1', '', '', ''],
        ]);
      });

      it('filters by metric', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            metrics: [{tag: 'acc', value: 0.5}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            metrics: [{tag: 'acc', value: 1}],
          }),
          buildRun({
            id: 'id3',
            name: 'Book 3',
            metrics: [{tag: 'acc', value: 0}],
          }),
        ]);
        store.overrideSelector(
          getRunMetricFilterMap,
          buildMetricFilterMap([
            [
              'acc',
              buildIntervalFilter({
                includeUndefined: false,
                filterLowerValue: 0.4,
                filterUpperValue: 1,
              }),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 1', '', '', '', '0.5', ''],
          ['Book 2', '', '', '', '1', ''],
        ]);
      });

      it('allows filter for only undefined metric value', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            metrics: [{tag: 'acc', value: 0.5}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            metrics: [{tag: 'acc', value: 1}],
          }),
          buildRun({id: 'id3', name: 'Book 3', metrics: []}),
        ]);
        store.overrideSelector(
          getRunMetricFilterMap,
          buildMetricFilterMap([
            [
              'acc',
              buildIntervalFilter({
                includeUndefined: true,
                filterLowerValue: 5,
                filterUpperValue: 5,
              }),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 3', '', '', '', '', ''],
        ]);
      });

      it('does not filter by hparams or metrics when it does not show one', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            hparams: [
              {name: 'foo', value: 'bar'},
              {name: 'qaz', value: 0.3},
            ],
            metrics: [{tag: 'acc', value: 0.3}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            hparams: [
              {name: 'foo', value: 'baz'},
              {name: 'qaz', value: 0.5},
            ],
          }),
          buildRun({
            id: 'id3',
            name: 'Book 3',
            hparams: [{name: 'foo', value: 'faz'}],
            metrics: [{tag: 'acc', value: 0.5}],
          }),
          buildRun({id: 'id4', name: 'Book 4', hparams: []}),
        ]);
        store.overrideSelector(
          getRunHparamFilterMap,
          new Map([
            [
              'foo',
              buildDiscreteFilter({
                includeUndefined: false,
                filterValues: ['bar', 'faz'],
              }),
            ],
          ])
        );
        store.overrideSelector(
          getRunMetricFilterMap,
          new Map([
            [
              'acc',
              buildIntervalFilter({
                includeUndefined: false,
                filterLowerValue: 0.4,
                filterUpperValue: 0.5,
              }),
            ],
          ])
        );

        const showHparamAndMetric = false;
        const fixture = createComponent(
          TEST_HPARAM_SPECS,
          TEST_METRIC_SPECS,
          showHparamAndMetric
        );
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 1'],
          ['Book 2'],
          ['Book 3'],
          ['Book 4'],
        ]);
      });

      it('responds to filter changes', () => {
        store.overrideSelector(getRuns, [
          buildRun({
            id: 'id1',
            name: 'Book 1',
            hparams: [{name: 'foo', value: 'bar'}],
          }),
          buildRun({
            id: 'id2',
            name: 'Book 2',
            hparams: [{name: 'foo', value: 'baz'}],
          }),
          buildRun({
            id: 'id3',
            name: 'Book 3',
            hparams: [{name: 'foo', value: 'faz'}],
          }),
          buildRun({id: 'id4', name: 'Book 4', hparams: []}),
        ]);

        store.overrideSelector(
          getRunHparamFilterMap,
          buildHparamFilterMap([
            [
              'foo',
              buildDiscreteFilter({
                includeUndefined: false,
                filterValues: ['bar', 'faz'],
              }),
            ],
          ])
        );

        const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
        fixture.detectChanges();

        store.overrideSelector(
          getRunHparamFilterMap,
          buildHparamFilterMap([
            [
              'foo',
              buildDiscreteFilter({
                includeUndefined: false,
                filterValues: ['faz'],
              }),
            ],
          ])
        );
        store.refreshState();
        fixture.detectChanges();

        expect(getTableRowTextContent(fixture)).toEqual([
          ['Book 3', '', '', 'faz', '', ''],
        ]);
      });

      describe('filtering ui', () => {
        function getOverlayMenuItems() {
          return Array.from(
            overlayContainer
              .getContainerElement()
              .querySelectorAll('[mat-menu-item]')
          );
        }

        beforeEach(() => {
          store.overrideSelector(getRuns, [
            buildRun({
              id: 'id1',
              name: 'Book 1',
              hparams: [{name: 'foo', value: 'bar'}],
            }),
            buildRun({
              id: 'id2',
              name: 'Book 2',
              hparams: [{name: 'foo', value: 'baz'}],
              metrics: [{tag: 'acc', value: 0.995}],
            }),
            buildRun({
              id: 'id3',
              name: 'Book 3',
              hparams: [{name: 'foo', value: 'faz'}],
              metrics: [{tag: 'acc', value: 0.25}],
            }),
            buildRun({id: 'id4', name: 'Book 4', hparams: []}),
          ]);
        });

        it('shows discrete hparams with checkboxes', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'foo',
                buildDiscreteFilter({
                  possibleValues: ['faz', 'bar', 'baz'],
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[3].querySelector('button').click();
          const menuItems = getOverlayMenuItems();

          expect(menuItems.length).toBe(4);
          expect(
            menuItems.map((menuItem) => {
              return menuItem
                .querySelector('mat-checkbox')!
                .textContent!.trim();
            })
          ).toEqual(['(show empty value)', 'faz', 'bar', 'baz']);
        });

        it('dispatches hparam action when clicking on the checkbox', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'foo',
                buildDiscreteFilter({
                  includeUndefined: false,
                  possibleValues: ['faz', 'bar', 'baz'],
                  filterValues: ['bar', 'faz'],
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[3].querySelector('button').click();
          const [, menuItemFoo] = getOverlayMenuItems();

          const checkbox = menuItemFoo.querySelector(
            'mat-checkbox input'
          ) as HTMLElement;
          checkbox.click();
          expect(dispatchSpy).toHaveBeenCalledWith(
            runDiscreteHparamFilterChanged({
              hparamName: 'foo',
              includeUndefined: false,
              filterValues: ['bar'],
            })
          );
        });

        it('dispatches includeUndefined change for discrete hparam change', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'foo',
                buildDiscreteFilter({
                  includeUndefined: false,
                  possibleValues: ['faz', 'bar', 'baz'],
                  filterValues: ['bar', 'faz'],
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[3].querySelector('button').click();
          const [includeUndefined] = getOverlayMenuItems();

          const checkbox = includeUndefined.querySelector(
            'mat-checkbox input'
          ) as HTMLElement;
          checkbox.click();
          expect(dispatchSpy).toHaveBeenCalledWith(
            runDiscreteHparamFilterChanged({
              hparamName: 'foo',
              includeUndefined: true,
              filterValues: ['bar', 'faz'],
            })
          );
        });

        it('shows interval hparams with tb-range-input', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'batch_size',
                buildIntervalFilter({
                  includeUndefined: true,
                  filterLowerValue: 16,
                  filterUpperValue: 128,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[1].querySelector('button').click();
          const menuItems = getOverlayMenuItems();

          expect(menuItems.length).toBe(2);
          const [min, max] = Array.from(menuItems[1].querySelectorAll('input'));
          expect(min.value).toBe('16');
          expect(max.value).toBe('128');
        });

        it('dispatches hparam action when tb-range-input changes', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'batch_size',
                buildIntervalFilter({
                  includeUndefined: true,
                  filterLowerValue: 16,
                  filterUpperValue: 128,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[1].querySelector('button').click();
          const [, slider] = getOverlayMenuItems();

          const minValue = slider.querySelectorAll(
            'tb-range-input input'
          )[0] as HTMLInputElement;
          minValue.value = '32';
          minValue.dispatchEvent(new Event('change'));
          expect(dispatchSpy).toHaveBeenCalledWith(
            runIntervalHparamFilterChanged({
              hparamName: 'batch_size',
              includeUndefined: true,
              filterLowerValue: 32,
              filterUpperValue: 128,
            })
          );
        });

        it('dispatches includeUndefined change for interval hparam change', () => {
          store.overrideSelector(
            getRunHparamFilterMap,
            buildHparamFilterMap([
              [
                'batch_size',
                buildIntervalFilter({
                  includeUndefined: true,
                  filterLowerValue: 16,
                  filterUpperValue: 128,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[1].querySelector('button').click();
          const [includeUndefined] = getOverlayMenuItems();

          const checkbox = includeUndefined.querySelector(
            'mat-checkbox input'
          ) as HTMLElement;
          checkbox.click();
          expect(dispatchSpy).toHaveBeenCalledWith(
            runIntervalHparamFilterChanged({
              hparamName: 'batch_size',
              includeUndefined: false,
              filterLowerValue: 16,
              filterUpperValue: 128,
            })
          );
        });

        it('shows metric value with tb-range-input based on runs', () => {
          store.overrideSelector(
            getRunMetricFilterMap,
            buildMetricFilterMap([
              [
                'acc',
                buildIntervalFilter({
                  includeUndefined: false,
                  filterLowerValue: 0.25,
                  filterUpperValue: 0.995,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[4].querySelector('button').click();
          const menuItems = getOverlayMenuItems();

          expect(menuItems.length).toBe(2);
          const [min, max] = Array.from(menuItems[1].querySelectorAll('input'));
          expect(min.value).toBe('0.25');
          expect(max.value).toBe('0.995');
        });

        it('dispatches metric action when tb-range-input changes', () => {
          store.overrideSelector(
            getRunMetricFilterMap,
            buildMetricFilterMap([
              [
                'acc',
                buildIntervalFilter({
                  includeUndefined: false,
                  filterLowerValue: 0.25,
                  filterUpperValue: 1,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[4].querySelector('button').click();
          const [, slider] = getOverlayMenuItems();

          const maxValue = slider.querySelectorAll(
            'tb-range-input input'
          )[1] as HTMLInputElement;
          maxValue.value = '0.32';
          maxValue.dispatchEvent(new Event('change'));
          expect(dispatchSpy).toHaveBeenCalledWith(
            runMetricFilterChanged({
              metricTag: 'acc',
              includeUndefined: false,
              filterLowerValue: 0.25,
              filterUpperValue: 0.32,
            })
          );
        });

        it('dispatches metric action for includeUndefined change', () => {
          store.overrideSelector(
            getRunMetricFilterMap,
            buildMetricFilterMap([
              [
                'acc',
                buildIntervalFilter({
                  includeUndefined: false,
                  filterLowerValue: 0.25,
                  filterUpperValue: 1,
                }),
              ],
            ])
          );
          const fixture = createComponent(TEST_HPARAM_SPECS, TEST_METRIC_SPECS);
          fixture.detectChanges();

          const columnHeaders = fixture.nativeElement.querySelectorAll('th');
          columnHeaders[4].querySelector('button').click();
          const [checkbox] = getOverlayMenuItems();
          const input = checkbox.querySelector('input') as HTMLInputElement;

          input.click();

          expect(dispatchSpy).toHaveBeenCalledWith(
            runMetricFilterChanged({
              metricTag: 'acc',
              includeUndefined: true,
              filterLowerValue: 0.25,
              filterUpperValue: 1,
            })
          );
        });
      });
    });
  });
});
