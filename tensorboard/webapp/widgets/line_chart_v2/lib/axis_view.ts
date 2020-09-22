import {ticks} from 'd3-array';
import {format} from 'd3-format';

import {LayoutStrategy} from './layout';
import {Rect} from './types';
import {TextAlign} from './renderer_types';
import {Drawable, DrawableConfig} from './drawable';

function getTicks(rect: Rect): {xs: number[]; ys: number[]} {
  return {
    xs: ticks(rect.x, rect.x + rect.width, 10),
    ys: ticks(rect.y, rect.y + rect.height, 6),
  };
}

const d3AxisFormatter = format('.3~s');

function axisFormatter(num: number): string {
  const absNum = Math.abs(num);
  if (absNum >= 1000 || absNum <= 0.001) {
    return d3AxisFormatter(num);
  }
  return String(num);
}

const AXIS_COLOR = '#555';
const GRID_COLOR = '#ccc';

export class YAxisView extends Drawable {
  constructor(config: DrawableConfig) {
    super(
      {
        ...config,
        widthLayoutStrategy: LayoutStrategy.FIXED,
      },
      []
    );
  }

  proposeWidth(): number {
    return 60;
  }

  redraw() {
    const viewRect = this.coordinator.getCurrentViewportRect();
    const layoutRect = this.getLayoutRect();

    const [xMin, yMin] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x,
      viewRect.y,
    ]);
    const [xMax, yMax] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x + viewRect.width,
      viewRect.y + viewRect.height,
    ]);

    this.renderer.drawLine(
      'yaxis',
      new Float32Array([xMax, yMin, xMax, yMax]),
      {
        color: AXIS_COLOR,
        visible: true,
        width: 1,
      }
    );

    const textSize = this.coordinator.getVerticalSize(10);
    for (const tick of getTicks(viewRect).ys) {
      const [, y] = this.coordinator.getViewCoordinate(layoutRect, [
        viewRect.x,
        tick,
      ]);
      this.renderer.drawText(`label_${tick}`, axisFormatter(tick), {
        size: textSize,
        color: AXIS_COLOR,
        position: {x: xMax - this.coordinator.getHorizontalPaddingSize(5), y},
        horizontalAlign: TextAlign.END,
        verticalAlign: TextAlign.CENTER,
      });
    }
  }
}

export class XAxisView extends Drawable {
  constructor(config: DrawableConfig) {
    super(
      {
        ...config,
        heightLayoutStrategy: LayoutStrategy.FIXED,
      },
      []
    );
  }

  proposeHeight(): number {
    return 30;
  }

  redraw() {
    const viewRect = this.coordinator.getCurrentViewportRect();
    const layoutRect = this.getLayoutRect();

    const [x1, y1] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x + viewRect.width,
      viewRect.y + viewRect.height,
    ]);
    const [x2, y2] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x,
      viewRect.y,
    ]);

    this.renderer.drawLine('axis', new Float32Array([x1, y1, x2, y1]), {
      color: AXIS_COLOR,
      visible: true,
      width: 1,
    });

    const textSize = this.coordinator.getVerticalSize(10);

    for (const tick of getTicks(viewRect).xs) {
      const [x] = this.coordinator.getViewCoordinate(layoutRect, [
        tick,
        viewRect.y,
      ]);

      this.renderer.drawText(`label_${tick}`, axisFormatter(tick), {
        size: textSize,
        color: AXIS_COLOR,
        position: {x, y: y1 + this.coordinator.getVerticalPaddingSize(5)},
        horizontalAlign: TextAlign.CENTER,
        verticalAlign: TextAlign.START,
      });
    }
  }
}

export class GridView extends Drawable {
  redraw() {
    const viewRect = this.coordinator.getCurrentViewportRect();
    const layoutRect = this.getLayoutRect();

    const [xMin, yMin] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x,
      viewRect.y,
    ]);
    const [xMax, yMax] = this.coordinator.getViewCoordinate(layoutRect, [
      viewRect.x + viewRect.width,
      viewRect.y + viewRect.height,
    ]);

    const {xs, ys} = getTicks(viewRect);

    for (const xTick of xs) {
      const [x] = this.coordinator.getViewCoordinate(layoutRect, [xTick, 0]);
      this.renderer.drawLine(
        `grid_vert_${x}`,
        new Float32Array([x, yMin, x, yMax]),
        {
          color: GRID_COLOR,
          visible: true,
          width: 1,
        }
      );
    }

    for (const yTick of ys) {
      const [, y] = this.coordinator.getViewCoordinate(layoutRect, [0, yTick]);

      this.renderer.drawLine(
        `grid_horz_${y}`,
        new Float32Array([xMin, y, xMax, y]),
        {
          color: GRID_COLOR,
          visible: true,
          width: 1,
        }
      );
    }

    // Accentuate zeros with darker gray.
    const [xZero, yZero] = this.coordinator.getViewCoordinate(layoutRect, [
      0,
      0,
    ]);
    this.renderer.drawLine(
      `grid_horz_${yZero}`,
      new Float32Array([xMin, yZero, xMax, yZero]),
      {
        color: AXIS_COLOR,
        visible: true,
        width: 1,
      }
    );

    this.renderer.drawLine(
      `grid_vert_${xZero}`,
      new Float32Array([xZero, yMin, xZero, yMax]),
      {
        color: AXIS_COLOR,
        visible: true,
        width: 1,
      }
    );
  }
}
