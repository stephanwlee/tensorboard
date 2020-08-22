export class ColorProvider {
  private readonly colorMap = new Map<string, string>();

  setColor(id: string, color: string) {
    this.colorMap.set(id, color);
  }

  getColor(id: string): string {
    return this.colorMap.get(id) || '#f00';
  }
}
