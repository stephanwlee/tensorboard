import {LayerOption, ChartExportedLayouts, DataSeries} from './types';
import {Layer} from './layer';
import {
  MainToGuestEvent,
  MainToGuestMessage,
  RendererType,
  InitMessage,
  GuestToMainType,
} from './worker_layer_types';

self.addEventListener('message', (event: MessageEvent) => {
  craetePortHandler(event.ports[0], event.data as InitMessage);
});

function craetePortHandler(port: MessagePort, initMessage: InitMessage) {
  let lineChart: Layer;
  const {
    canvas,
    workerId,
    devicePixelRatio,
    rect,
    rendererType,
    layouts,
  } = initMessage;

  const lineChartCallbacks = {
    onLayout: (layouts: ChartExportedLayouts) => {
      port.postMessage({
        type: GuestToMainType.LAYOUT_CHANGED,
        layouts,
      });
    },
  };

  let layerOption: LayerOption;
  switch (rendererType) {
    case RendererType.CANVAS:
      layerOption = {
        domRect: rect,
        container: canvas,
        type: RendererType.CANVAS,
        devicePixelRatio,
        callbacks: lineChartCallbacks,
      };
      break;
    case RendererType.WEBGL:
      layerOption = {
        domRect: rect,
        callbacks: lineChartCallbacks,
        container: canvas,
        type: RendererType.WEBGL,
        devicePixelRatio,
      };
      break;
  }

  if (!layerOption) {
    return;
  }

  lineChart = new Layer(workerId, layerOption, layouts);

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
