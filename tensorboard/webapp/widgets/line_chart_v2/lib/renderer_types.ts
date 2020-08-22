import {Rect, Paths} from './types';

export enum TextAlign {
  END,
  START,
  CENTER,
}

export interface TextSpec {
  color: string;
  size: number;
  position: {x: number; y: number};
  horizontalAlign: TextAlign;
  verticalAlign: TextAlign;
}

export interface Renderer {
  onResize(rect: Rect): void;
  resetRect(rect: Rect): void;
  drawLine(id: string, paths: Paths, spec: LineSpec): void;
  drawText(id: string, text: string, spec: TextSpec): void;
  render(): void;
  clearForTesting(): void;
  renderGroup(groupName: string, renderBlock: () => void): void;
}

export interface LineSpec {
  visible: boolean;
  color: string;
  width: number;
}
