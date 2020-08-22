import {DataDrawable} from './drawable';

export class SeriesLineView extends DataDrawable {
  redraw() {
    for (const series of this.series) {
      this.renderer.drawLine(series.name, series.paths, {
        color: this.colorProvider.getColor(series.name),
        visible: this.visibilityMap.get(series.name) || false,
        width: 1,
      });
    }
  }
}
