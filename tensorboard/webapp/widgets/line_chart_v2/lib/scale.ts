import {scaleLinear, scaleLog} from 'd3-scale';
import * as tf from '@tensorflow/tfjs';

import {Rect, Extent, ScaleType} from './types';

export interface Scale {
  forward(domain: [number, number], range: [number, number], x: number): number;

  forwardBatch(
    domain: [number, number],
    range: [number, number],
    xs: ArrayLike<number>
  ): Promise<Float32Array>;

  invert(domain: [number, number], range: [number, number], x: number): number;

  nice(minAndMax: [number, number]): [number, number];

  ticks(domain: [number, number], count: number): number[];
}

export function createScale(type: ScaleType): Scale {
  switch (type) {
    case ScaleType.LINEAR:
      return new LinearScale();
    case ScaleType.LOG10:
      return new Log10Scale();
    default:
      throw new RangeError(`ScaleType ${type} not supported.`);
  }
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

  forwardBatch(
    domain: [number, number],
    range: [number, number],
    xs: ArrayLike<number>
  ): Promise<Float32Array> {
    const [domainMin, domainMax] = domain;
    const domainSpread = domainMax - domainMin;
    const [rangeMin, rangeMax] = range;
    const rangeSpread = rangeMax - rangeMin;

    return tf
      .tensor(xs)
      .sub(tf.scalar(domainMin))
      .mul(tf.scalar(rangeSpread / domainSpread))
      .add(tf.scalar(rangeMin))
      .data() as Promise<Float32Array>;
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

  ticks(domain: [number, number], count: number): number[] {
    return scaleLinear().domain(domain).ticks(count);
  }
}

export class Log10Scale implements Scale {
  private transform(x: number): number {
    return Math.log10(x > 0 ? x : Number.MIN_VALUE);
  }

  private untransform(x: number): number {
    return Math.exp(x / Math.LOG10E);
  }

  forward(
    domain: [number, number],
    range: [number, number],
    x: number
  ): number {
    const [domainMin, domainMax] = domain;
    const [rangeMin, rangeMax] = range;

    const transformedMin = this.transform(domainMin);
    const transformedMax = this.transform(domainMax);
    const domainSpread = transformedMax - transformedMin;
    const rangeSpread = rangeMax - rangeMin;
    x = this.transform(x);

    return (
      (rangeSpread / (domainSpread + Number.EPSILON)) * (x - transformedMin) +
      rangeMin
    );
  }

  forwardBatch(
    domain: [number, number],
    range: [number, number],
    xs: Float32Array
  ): Promise<Float32Array> {
    const [domainMin, domainMax] = domain;
    const [rangeMin, rangeMax] = range;

    const transformedMin = this.transform(domainMin);
    const transformedMax = this.transform(domainMax);
    const domainSpread = transformedMax - transformedMin;
    const rangeSpread = rangeMax - rangeMin;
    const x = this.transform(xs[0]);

    return Promise.resolve(
      new Float32Array([
        (rangeSpread / (domainSpread + Number.EPSILON)) * (x - transformedMin) +
          rangeMin,
      ])
    );
  }

  invert(domain: [number, number], range: [number, number], x: number): number {
    const [domainMin, domainMax] = domain;
    const [rangeMin, rangeMax] = range;

    const transformedMin = this.transform(domainMin);
    const transformedMax = this.transform(domainMax);
    const domainSpread = transformedMax - transformedMin;
    const rangeSpread = rangeMax - rangeMin;

    const val =
      (domainSpread / (rangeSpread + Number.EPSILON)) * (x - rangeMin) +
      transformedMin;
    return this.untransform(val);
  }

  nice(minAndMax: [number, number]): [number, number] {
    const [min, max] = minAndMax;

    const [niceMin, niceMax] = scaleLog()
      .domain([
        min > 0 ? min : Number.MIN_VALUE,
        max > 0 ? max : Number.MIN_VALUE,
      ])
      .nice()
      .domain();
    return [niceMin, niceMax];
  }

  ticks(domain: [number, number], count: number): number[] {
    const low = domain[0] <= 0 ? Number.MIN_VALUE : domain[0];
    const high = domain[1] <= 0 ? Number.MIN_VALUE : domain[1];
    const ticks = scaleLog().domain([low, high]).ticks(count);
    return ticks.length ? ticks : domain;
  }
}
