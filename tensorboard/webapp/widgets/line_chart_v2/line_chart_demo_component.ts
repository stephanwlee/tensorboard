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
import {Component, ChangeDetectionStrategy} from '@angular/core';
import {DataSeries, DataSeriesMetadataMap, ScaleType} from './lib/types';
import {createDataSeries} from './create_data';

const NUM_SERIES = 5;
const NUM_POINTS = 1000;

const COLORS = [
  '#4184f3',
  '#db4437',
  '#f4b400',
  '#0f9d58',
  '#aa46bb',
  '#00abc0',
  '#ff6f42',
  '#9d9c23',
  '#5b6abf',
  '#ef6191',
  '#00786a',
  '#c1175a',
  '#9E9E9E',
];

@Component({
  selector: 'line-chart-demo',
  template: `
    <line-chart
      [seriesData]="seriesData"
      [seriesMetadataMap]="metadataMap"
      [xScaleType]="ScaleType.LINEAR"
      [yScaleType]="ScaleType.LINEAR"
    ></line-chart>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        height: 600px;
        width: 800px;
      }

      line-chart {
        display: inline-block;
        contain: strict;
        height: 100%;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartDemoComponent {
  readonly seriesData: DataSeries[] = createDataSeries(NUM_SERIES, NUM_POINTS);

  readonly ScaleType = ScaleType;

  readonly metadataMap: DataSeriesMetadataMap = this.seriesData.reduce(
    (metadataMap, {id}, index) => {
      metadataMap[id] = {
        id,
        displayName: id,
        color: COLORS[index % COLORS.length],
        visible: true,
      };
      return metadataMap;
    },
    {} as DataSeriesMetadataMap
  );
}
