import {CompositeLayout} from './composite_layout';
import {DrawableConfig} from './drawable';
import {FlexLayout} from './flex_layout';
import {GridView, XAxisView, YAxisView} from './axis_view';
import {
  CompositeLayoutConfig,
  LayoutChildren,
  LayoutConfig,
  ViewType,
  Rect,
} from './types';
import {LayoutOption, LayoutRect} from './layout';
import {RootLayout} from './root_layout';
import {SeriesLineView} from './series_line_view';

type LayoutConfigLike =
  | LayoutConfig
  | {
      type: 'root';
      children: LayoutChildren;
    };

export function createRootLayout(
  layoutChildren: LayoutChildren,
  option: LayoutOption & DrawableConfig,
  domRect: Rect
): RootLayout {
  function createLayout(config: LayoutConfigLike): LayoutRect {
    const children = [];
    for (const row of config.children ?? []) {
      if (Array.isArray(row)) {
        const layoutRow = [];
        for (const column of row) {
          layoutRow.push(createLayout(column));
        }
        children.push(layoutRow);
      } else {
        const layout = row as CompositeLayoutConfig['children'][number];
        children.push([createLayout(layout)]);
      }
    }

    switch (config.type) {
      case 'root':
        return new RootLayout(option, children, domRect);
      case ViewType.Y_AXIS_VIEW:
        return new YAxisView(option);
      case ViewType.X_AXIS_VIEW:
        return new XAxisView(option);
      case ViewType.FLEX_LAYOUT:
        return new FlexLayout(option, children);
      case ViewType.GRID_VIEW:
        return new GridView(option, children);
      case ViewType.SERIES_LINE_VIEW:
        return new SeriesLineView(option, children);
      case ViewType.COMPOSITE_LAYOUT:
        return new CompositeLayout(option, children.flat());
    }
  }

  return createLayout({
    type: 'root',
    children: layoutChildren,
  }) as RootLayout;
}
