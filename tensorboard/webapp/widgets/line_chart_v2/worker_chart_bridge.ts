import {ChartExportedLayouts, DataSeries} from './lib/types';
import {LineChart} from './lib/line_chart';
import {
  MainToGuestEvent,
  MainToGuestMessage,
  ChartType,
  InitMessage,
  GuestToMainType,
} from './offscreen_chart_types';

self.addEventListener('message', (event: MessageEvent) => {
  craetePortHandler(event.ports[0], event.data as InitMessage);
});

function craetePortHandler(port: MessagePort, initMessage: InitMessage) {
  let lineChart: LineChart;
  const {canvas, workerId, devicePixelRatio, rect, chartType} = initMessage;

  const lineChartCallbacks = {
    onLayout: (layouts: ChartExportedLayouts) => {
      port.postMessage({
        type: GuestToMainType.LAYOUT_CHANGED,
        layouts,
      });
    },
  };

  switch (chartType) {
    case ChartType.CANVAS:
      lineChart = new LineChart(
        workerId,
        rect,
        {
          container: canvas,
          type: ChartType.CANVAS,
          devicePixelRatio,
        },
        lineChartCallbacks
      );
      break;
    case ChartType.WEBGL:
      lineChart = new LineChart(
        workerId,
        rect,
        {
          container: canvas,
          type: ChartType.WEBGL,
          devicePixelRatio,
        },
        lineChartCallbacks
      );
      break;
  }

  port.onmessage = function (event: MessageEvent) {
    const message = event.data as MainToGuestMessage;
    switch (message.type) {
      case MainToGuestEvent.SERIES_DATA_UPDATE: {
        const rawData = new Float32Array(message.flattenedSeries);
        const data: DataSeries[] = [];
        let rawDataIndex = 0;

        for (const {name, length} of message.namesAndLengths) {
          const points = [] as Array<{x: number; y: number}>;
          for (let index = 0; index < length; index++) {
            points.push({
              x: rawData[rawDataIndex++],
              y: rawData[rawDataIndex++],
            });
          }
          data.push({
            name,
            points,
          });
        }

        lineChart.updateData(data, message.extent);
        break;
      }
      case MainToGuestEvent.SERIES_METADATA_CHANGED: {
        lineChart.updateMetadata(message.metadata);
        break;
      }
      case MainToGuestEvent.SERIES_DATA_UPDATE: {
        break;
      }
      case MainToGuestEvent.UPDATE_VIEW_BOX: {
        lineChart.updateViewbox(message.extent);
        break;
      }
      case MainToGuestEvent.RESIZE: {
        lineChart.resize(message.rect);
        break;
      }
    }
  };
}
