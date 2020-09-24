import {Rect} from './types';

export enum LayoutStrategy {
  MATCH_PARENT,
  FIXED,
}

export interface LayoutOption {
  container: OffscreenCanvas | Element;
  widthLayoutStrategy?: LayoutStrategy;
  heightLayoutStrategy?: LayoutStrategy;
}

/**
 * ContentArea is an area that has content. A ContentArea can nest other ContentAreas.
 */
export abstract class LayoutRect {
  protected readonly widthLayoutStrategy: LayoutStrategy;
  protected readonly heightLayoutStrategy: LayoutStrategy;

  protected readonly container: Element | OffscreenCanvas;

  private readonly contentGrid: LayoutRect[][];
  private layout: Rect | null = null;

  protected layoutChanged: boolean = true;

  constructor(config: LayoutOption, contentGrid: LayoutRect[][] = []) {
    const configWithDefault = {
      widthLayoutStrategy: LayoutStrategy.MATCH_PARENT,
      heightLayoutStrategy: LayoutStrategy.MATCH_PARENT,
      ...config,
    };
    this.widthLayoutStrategy = configWithDefault.widthLayoutStrategy;
    this.heightLayoutStrategy = configWithDefault.heightLayoutStrategy;
    this.container = configWithDefault.container;

    this.validateContentGrid(contentGrid);
    this.contentGrid = contentGrid;
  }

  private validateContentGrid(contentGrid: LayoutRect[][]) {
    if (!contentGrid.length) {
      return;
    }
    const expectedColumnLength = contentGrid[0].length;
    for (const gridRow of contentGrid) {
      if (gridRow.length !== expectedColumnLength) {
        throw new RangeError('Expected grid to have same column counts');
      }
    }
  }

  /**
   * Triggered when container dimension changes or when data extent changes.
   */
  proposeWidth(): number {
    if (this.widthLayoutStrategy === LayoutStrategy.FIXED) {
      throw new Error('proposeWidth is a required method for FIXED layout');
    }
    return 0;
  }

  /**
   * Triggered when container dimension changes or when data extent changes.
   */
  proposeHeight(): number {
    if (this.heightLayoutStrategy === LayoutStrategy.FIXED) {
      throw new Error('proposeHeight is a required method for FIXED layout');
    }
    return 0;
  }

  getLayoutRect() {
    if (!this.layout) {
      throw new Error(
        'Invariant error: cannot read layout before layout is invoked'
      );
    }
    return this.layout;
  }

  children(): ReadonlyArray<LayoutRect> {
    return this.contentGrid.flat();
  }

  getWidth(): number {
    return this.layout ? this.layout.width : 0;
  }

  getHeight(): number {
    return this.layout ? this.layout.height : 0;
  }

  getWidthLayoutStrategy(): LayoutStrategy {
    return this.widthLayoutStrategy;
  }

  getHeightLayoutStrategy(): LayoutStrategy {
    return this.heightLayoutStrategy;
  }

  internalOnlySetLayout(layout: Rect) {
    const originalLayout = this.layout;

    this.layout = layout;

    if (
      originalLayout &&
      layout.x === originalLayout.x &&
      layout.y === originalLayout.y &&
      layout.width === originalLayout.width &&
      layout.height === originalLayout.height
    ) {
      return;
    }

    // When the layout changes, we need to repaint.
    this.layoutChanged = true;
  }

  internalOnlySetLayoutOnResize(layout: Rect) {
    this.internalOnlySetLayout(layout);
    this.relayout();
  }

  /**
   * Quirk: this is not a grid. Each row layout is computed separately.
   * e.g., if a row has two fixed columns and two flex columns, two flex columns
   * get equal width of a remaining width.
   *
   */
  private relayout() {
    if (!this.layout) {
      throw new RangeError('Require `layout` to be set before relaying out');
    }

    interface Dimension {
      width: number | null;
      height: number | null;
    }
    const dimensions: Dimension[][] = [];
    const selfWidth = this.getWidth();
    const selfHeight = this.getHeight();
    const rowCount = this.contentGrid.length;
    const columnCount = (this.contentGrid[0] || []).length;

    // 1. gather all fixed/concrete dimensions. Set flexible ones as `null`.
    for (const childrenRow of this.contentGrid) {
      const rowDimensions: Dimension[] = [];
      dimensions.push(rowDimensions);
      for (const childContentArea of childrenRow) {
        const columnDimension: Dimension = {
          width: null,
          height: null,
        };
        if (
          childContentArea.getWidthLayoutStrategy() === LayoutStrategy.FIXED
        ) {
          columnDimension.width = childContentArea.proposeWidth();
        }
        if (
          childContentArea.getHeightLayoutStrategy() === LayoutStrategy.FIXED
        ) {
          columnDimension.height = childContentArea.proposeHeight();
        }
        rowDimensions.push(columnDimension);
      }
    }

    // 2. calculate max width per column and max height per row.
    const rowHeights: Array<number | null> = [];
    const columnWidths: Array<number | null> = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const dimRow = dimensions[rowIndex];
      const maxHeightForRow = Math.max(
        ...dimRow.map(({height}) => height || 0)
      );
      rowHeights.push(maxHeightForRow === 0 ? null : maxHeightForRow);
    }

    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const maxWidthForColumn = Math.max(
        ...dimensions.map((row) => row[colIndex].width || 0)
      );
      columnWidths.push(maxWidthForColumn === 0 ? null : maxWidthForColumn);
    }

    // 3. compute concrete width/height for flexible ones and form a dense matrix
    // on dimensions
    const numFlexRows = rowHeights.filter((row) => row === null).length;
    const flexibleHeight = rowHeights.reduce(
      (remaining: number, height: number | null) => {
        if (height === null) {
          return remaining;
        }
        return Math.max(remaining - height, 0);
      },
      selfHeight
    );

    const numFlexColumns = columnWidths.filter((column) => column === null)
      .length;
    const flexibleWidth = columnWidths.reduce(
      (remaining: number, width: number | null) => {
        if (width === null) {
          return remaining;
        }
        return Math.max(remaining - width, 0);
      },
      selfWidth
    );

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const height =
        rowHeights[rowIndex] !== null
          ? rowHeights[rowIndex]
          : flexibleHeight / numFlexRows;
      for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const width =
          columnWidths[colIndex] !== null
            ? columnWidths[colIndex]
            : flexibleWidth / numFlexColumns;

        dimensions[rowIndex][colIndex].height = height;
        dimensions[rowIndex][colIndex].width = width;
      }
    }

    let y = this.layout.y;
    // 4. compute offset coordinate and set them to the child content grid.
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const row = dimensions[rowIndex];
      let x = this.layout.x;
      for (let colIndex = 0; colIndex < columnCount; colIndex++) {
        const {width, height} = row[colIndex];
        this.contentGrid[rowIndex][colIndex].internalOnlySetLayout({
          x: x,
          y: y,
          width: width!,
          height: height!,
        });
        x += width!;
      }

      const height = row[0]?.height || 0;
      y += height;
    }
  }
}
