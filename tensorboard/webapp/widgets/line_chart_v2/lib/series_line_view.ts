import {DataDrawable} from './drawable';

export class SeriesLineView extends DataDrawable {
  redraw() {
    for (const series of this.series) {
      const metadata = this.metadataMap[series.id];
      this.renderer.drawLine(series.id, series.paths, {
        color: metadata.color,
        visible: metadata.visible || false,
        opacity: metadata.opacity ?? 1,
        width: 1,
      });
    }
  }
}
