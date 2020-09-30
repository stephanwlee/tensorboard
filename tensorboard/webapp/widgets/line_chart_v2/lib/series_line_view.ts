import {DataDrawable} from './drawable';

export class SeriesLineView extends DataDrawable {
  redraw() {
    for (const series of this.series) {
      this.renderer.drawLine(series.id, series.paths, {
        color: this.colorProvider.getColor(series.id),
        visible: this.visibilityMap.get(series.id) || false,
        width: 1,
      });
    }
  }
}
