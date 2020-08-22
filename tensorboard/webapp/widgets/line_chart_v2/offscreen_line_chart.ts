import {
  DataSeries,
  LineChartCallbacks,
  DataSeriesMetadataMap,
  ILineChart,
  LineChartOption,
  Rect,
  DataExtent,
  ViewExtent,
} from './lib/types';
import {getWorker} from './worker';
import {
  ChartType,
  GuestToMainMessage,
  GuestToMainType,
  MainToGuestEvent,
  MainToGuestMessage,
} from './offscreen_chart_types';

export class OffscreenLineChart implements ILineChart {
  private readonly toWorkerChannel: any;

  constructor(
    id: number,
    rect: Rect,
    option: LineChartOption,
    private readonly callbacks: LineChartCallbacks
  ) {
    if (option.type === ChartType.SVG) {
      throw new RangeError('Cannot use SVG for the offscreen line chart.');
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (message) => {
      this.onMessageFromWorker(message.data as GuestToMainMessage);
    };
    this.toWorkerChannel = channel.port1;

    const canvas = (option.container as HTMLCanvasElement).transferControlToOffscreen();

    const worker = getWorker('chart_worker.js');
    worker.postMessage(
      {
        type: MainToGuestEvent.INIT,
        workerId: id,
        canvas,
        devicePixelRatio: window.devicePixelRatio,
        rect,
        chartType: option.type,
      },
      [canvas, channel.port2]
    );
  }

  resize(rect: Rect): void {
    this.sendMessage({
      type: MainToGuestEvent.RESIZE,
      rect,
    });
  }

  updateMetadata(metadataMap: DataSeriesMetadataMap): void {
    this.sendMessage({
      type: MainToGuestEvent.SERIES_METADATA_CHANGED,
      metadata: metadataMap,
    });
  }

  updateViewbox(extent: ViewExtent): void {
    this.sendMessage({
      type: MainToGuestEvent.UPDATE_VIEW_BOX,
      extent,
    });
  }

  updateData(data: DataSeries[], extent: DataExtent): void {
    const totalLength = data.reduce((len: number, data: DataSeries) => {
      return len + data.points.length;
    }, 0);
    let seriesIndex = 0;
    const flattenedSeries = new Float32Array(totalLength * 2);
    const namesAndLengths: Array<{name: string; length: number}> = [];

    for (const series of data) {
      namesAndLengths.push({
        name: series.name,
        length: series.points.length,
      });
      for (let index = 0; index < series.points.length; index++) {
        flattenedSeries[seriesIndex++] = series.points[index].x;
        flattenedSeries[seriesIndex++] = series.points[index].y;
      }
    }

    this.sendMessage(
      {
        type: MainToGuestEvent.SERIES_DATA_UPDATE,
        namesAndLengths,
        flattenedSeries: flattenedSeries.buffer,
        extent,
      },
      [flattenedSeries.buffer]
    );
  }

  private sendMessage(message: MainToGuestMessage, transfer?: Transferable[]) {
    if (transfer) {
      this.toWorkerChannel.postMessage(message, transfer);
    } else {
      this.toWorkerChannel.postMessage(message);
    }
  }

  private onMessageFromWorker(message: GuestToMainMessage) {
    switch (message.type) {
      case GuestToMainType.LAYOUT_CHANGED: {
        this.callbacks.onLayout(message.layouts);
        break;
      }
    }
  }
}
