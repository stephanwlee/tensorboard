const cachedIsWebGl2Supported = Boolean(
  document.createElement('canvas').getContext('webgl2')
);

export function isWebGl2Supported(): boolean {
  return cachedIsWebGl2Supported;
}

export function isOffscreenCanvasSupported(): boolean {
  return window.hasOwnProperty('OffscreenCanvas');
}
