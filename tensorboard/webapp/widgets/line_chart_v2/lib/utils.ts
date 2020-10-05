const cachedIsWebGl2Supported = Boolean(
  self.hasOwnProperty('document') &&
    document.createElement('canvas').getContext('webgl2')
);

export function isWebGl2Supported(): boolean {
  return cachedIsWebGl2Supported;
}

export function isOffscreenCanvasSupported(): boolean {
  return self.hasOwnProperty('OffscreenCanvas');
}
