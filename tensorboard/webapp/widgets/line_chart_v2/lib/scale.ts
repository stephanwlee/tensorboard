import {scaleLinear} from 'd3-scale';

import {Rect, Extent} from './types';

export interface Scale {
  forward(domain: [number, number], range: [number, number], x: number): number;

  invert(domain: [number, number], range: [number, number], x: number): number;

  nice(minAndMax: [number, number]): [number, number];
}

export function convertRectToExtent(rect: Rect): Extent {
  return {
    x: [rect.x, rect.x + rect.width],
    y: [rect.y, rect.y + rect.height],
  };
}

export class LinearScale implements Scale {
  forward(
    domain: [number, number],
    range: [number, number],
    x: number
  ): number {
    const [domainMin, domainMax] = domain;
    const domainSpread = domainMax - domainMin;
    const [rangeMin, rangeMax] = range;
    const rangeSpread = rangeMax - rangeMin;

    return (rangeSpread / domainSpread) * (x - domainMin) + rangeMin;
  }

  invert(domain: [number, number], range: [number, number], x: number): number {
    const [domainMin, domainMax] = domain;
    const domainSpread = domainMax - domainMin;
    const [rangeMin, rangeMax] = range;
    const rangeSpread = rangeMax - rangeMin;

    return (domainSpread / rangeSpread) * (x - rangeMin) + domainMin;
  }

  nice(minAndMax: [number, number]): [number, number] {
    const [min, max] = minAndMax;
    const scale = scaleLinear();
    const padding = (max - min + Number.EPSILON) * 0.05;
    const [niceMin, niceMax] = scale
      .domain([min - padding, max + padding])
      .nice()
      .domain();
    return [niceMin, niceMax];
  }
}
