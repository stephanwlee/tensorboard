import {
  DataExtent,
  DataSeries,
  DataSeriesMetadataMap,
  LayerCallbacks,
  LayerOption,
  LayoutChildren,
  Rect,
  ScaleType,
  ViewExtent,
} from './types';
import {getWorkerInstance, WorkerLike} from './worker_allocator';
import {
  GuestToMainMessage,
  GuestToMainType,
  InitMessage,
  MainToGuestEvent,
  MainToGuestMessage,
  RendererType,
} from './worker_layer_types';
import {ILayer} from './layer_types';

export class WorkerLayer implements ILayer {
  private readonly txMessagePort: MessagePort;
  private readonly callbacks: LayerCallbacks;
  private readonly workerInstance: WorkerLike;

  constructor(id: number, option: LayerOption, layouts: LayoutChildren) {
    this.callbacks = option.callbacks;

    if (option.type === RendererType.SVG) {
      throw new RangeError('Cannot use SVG for the offscreen line chart.');
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (message) => {
      this.onMessageFromWorker(message.data as GuestToMainMessage);
    };
    this.txMessagePort = channel.port1;

    const canvas = (option.container as HTMLCanvasElement).transferControlToOffscreen();

    this.workerInstance = getWorkerInstance('chart_worker.js');
    this.workerInstance.postMessage(
      {
        type: MainToGuestEvent.INIT,
        workerId: id,
        canvas,
        layouts,
        devicePixelRatio: window.devicePixelRatio,
        rect: option.domRect,
        rendererType: option.type,
        xScaleType: option.xScaleType,
        yScaleType: option.yScaleType,
      } as InitMessage,
      [canvas, channel.port2]
    );
  }

  dispose() {
    this.workerInstance.free();
    this.txMessagePort.close();
  }

  setXScaleType(type: ScaleType) {
    this.sendMessage({
      type: MainToGuestEvent.SCALE_UPDATE,
      axis: 'x',
      scaleType: type,
    });
  }

  setYScaleType(type: ScaleType) {
    this.sendMessage({
      type: MainToGuestEvent.SCALE_UPDATE,
      axis: 'y',
      scaleType: type,
    });
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

  updateData(data: DataSeries[]): void {
    const totalLength = data.reduce((len: number, data: DataSeries) => {
      return len + data.points.length;
    }, 0);
    let seriesIndex = 0;
    const flattenedSeries = new Float32Array(totalLength * 2);
    const idsAndLengths: Array<{id: string; length: number}> = [];

    for (const series of data) {
      idsAndLengths.push({
        id: series.id,
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
        idsAndLengths,
        flattenedSeries: flattenedSeries.buffer,
      },
      [flattenedSeries.buffer]
    );
  }

  private sendMessage(
    message: Exclude<MainToGuestMessage, InitMessage>,
    transfer?: Transferable[]
  ) {
    if (transfer) {
      this.txMessagePort.postMessage(message, transfer);
    } else {
      this.txMessagePort.postMessage(message);
    }
  }

  private onMessageFromWorker(message: GuestToMainMessage) {
    switch (message.type) {
      case GuestToMainType.ON_REDRAW_END: {
        this.callbacks.onDrawEnd();
      }
    }
  }
}
