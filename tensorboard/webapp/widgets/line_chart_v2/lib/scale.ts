export interface Scale {
  domain(min: number, max: number): void;

  range(min: number, max: number): void;

  getDomain(): [number, number];

  getRange(): [number, number];

  getValue(x: number): number;

  invert(x: number): number;
}

export class LinearScale implements Scale {
  private paddingFactor: number = 0;
  private inMin = 1;
  private inSpread = 1;
  private outMin = 0;
  private outSpread = 1;

  pad(paddingPercent: number): this {
    this.paddingFactor = paddingPercent / 100;
    return this;
  }

  domain(min: number, max: number): this {
    const diff = max - min;
    this.inMin = min - diff * this.paddingFactor;
    this.inSpread = (1 + this.paddingFactor * 2) * diff;
    return this;
  }

  range(min: number, max: number): this {
    this.outMin = min;
    this.outSpread = max - min;
    return this;
  }

  getDomain(): [number, number] {
    return [this.inMin, this.inMin + this.inSpread];
  }

  getRange(): [number, number] {
    return [this.outMin, this.outMin + this.outSpread];
  }

  getValue(x: number): number {
    return (this.outSpread / this.inSpread) * (x - this.inMin) + this.outMin;
  }

  invert(x: number): number {
    return (this.inSpread / this.outSpread) * (x - this.outMin) + this.inMin;
  }
}
