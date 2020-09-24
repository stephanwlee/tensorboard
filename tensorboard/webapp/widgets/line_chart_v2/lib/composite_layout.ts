import {LayoutRect, LayoutStrategy, LayoutOption} from './layout';
import {Rect} from './types';

export class CompositeLayout extends LayoutRect {
  private readonly superposedLayouts: LayoutRect[];

  constructor(config: LayoutOption, contentColumns: LayoutRect[]) {
    let heightLayoutStrategy: LayoutStrategy = LayoutStrategy.MATCH_PARENT;
    let widthLayoutStrategy: LayoutStrategy = LayoutStrategy.MATCH_PARENT;
    for (const column of contentColumns) {
      if (column.getHeightLayoutStrategy() === LayoutStrategy.FIXED) {
        heightLayoutStrategy = LayoutStrategy.FIXED;
      }
      if (column.getWidthLayoutStrategy() === LayoutStrategy.FIXED) {
        widthLayoutStrategy = LayoutStrategy.FIXED;
      }
    }

    super(
      {
        ...config,
        heightLayoutStrategy,
        widthLayoutStrategy,
      },
      []
    );
    this.superposedLayouts = contentColumns;
  }

  children(): ReadonlyArray<LayoutRect> {
    return this.superposedLayouts;
  }

  proposeWidth(): number {
    let width = 0;
    if (this.widthLayoutStrategy === LayoutStrategy.FIXED) {
      for (const layout of this.children()) {
        if (layout.getWidthLayoutStrategy() === LayoutStrategy.FIXED) {
          width = Math.max(layout.proposeWidth(), width);
        }
      }
    }
    return width;
  }

  /**
   * Triggered when container dimension changes or when data extent changes.
   */
  proposeHeight(): number {
    let height = 0;
    if (this.heightLayoutStrategy === LayoutStrategy.FIXED) {
      for (const layout of this.children()) {
        if (layout.getHeightLayoutStrategy() === LayoutStrategy.FIXED) {
          height = Math.max(layout.proposeHeight(), height);
        }
      }
    }
    return height;
  }

  internalOnlySetLayout(rect: Rect) {
    super.internalOnlySetLayout(rect);
    for (const layout of this.children()) {
      layout.internalOnlySetLayout(rect);
    }
  }
}
