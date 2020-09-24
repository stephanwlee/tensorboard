import {DataDrawable, Drawable} from './drawable';
import {LayoutOption, LayoutRect} from './layout';
import {DataSeries, Rect} from './types';

export class RootLayout extends LayoutRect {
  constructor(config: LayoutOption, contentGrid: LayoutRect[][], rect: Rect) {
    super(config, contentGrid);
  }

  onResize(rect: Rect) {
    this.internalOnlySetLayoutOnResize(rect);
  }

  redraw() {
    for (const content of this.getAllDescendents()) {
      if (content instanceof DataDrawable) {
        content.internalOnlyTransformCoordinatesIfStale();
      }
      if (content instanceof Drawable) {
        content.internalOnlyRedraw();
      }
    }
  }

  markAsPaintDirty() {
    for (const content of this.getAllDescendents()) {
      if (content instanceof Drawable) {
        content.markAsPaintDirty();
      }
    }
  }

  setData(data: DataSeries[]) {
    for (const content of this.getAllDescendents()) {
      if (content instanceof DataDrawable) {
        return content.setData(data);
      }
    }
  }

  private *getAllDescendents(): Generator<LayoutRect> {
    const contents = [...this.children()];

    while (contents.length) {
      const content = contents.shift()!;
      contents.push(...content.children());
      yield content;
    }
  }

  findChildByClass<T extends LayoutRect>(
    klass: new (...params: any[]) => T
  ): T | null {
    for (const child of this.getAllDescendents()) {
      if (child instanceof klass) {
        return child;
      }
    }

    return null;
  }
}
