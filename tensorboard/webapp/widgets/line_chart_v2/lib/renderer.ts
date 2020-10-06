import * as THREE from 'three';
import {color as d3Color} from 'd3-color';

import {THREECoordinator} from './coordinator';
import {Roboto} from './fonts/roboto';
import {LineSpec, IRenderer, TextAlign, TextSpec} from './renderer_types';
import {Paths, Rect} from './types';
import {isOffscreenCanvasSupported} from './utils';

function arePathsEqual(pathA: Paths, pathB: Paths) {
  if (pathA.length !== pathB.length) {
    return false;
  }

  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) {
      return false;
    }
  }
  return true;
}

type RenderGroupMap<Cacheable, DataType> = Map<
  string,
  {
    data: DataType;
    cacheable: Cacheable;
  }
>;

abstract class Renderer<Cacheable, DataType> implements IRenderer {
  abstract onResize(rect: Rect): void;

  drawLine(cacheId: string, paths: Float32Array, spec: LineSpec): void {
    this.cacheIdsToRemove.delete(cacheId);
  }
  drawText(cacheId: string, text: string, spec: TextSpec): void {
    this.cacheIdsToRemove.delete(cacheId);
  }

  drawRect(cacheId: string, rect: Rect, color: string): void {
    this.cacheIdsToRemove.delete(cacheId);
  }

  abstract render(): void;

  private groupToCacheIdToCacheable = new Map<
    string,
    RenderGroupMap<Cacheable, DataType>
  >();
  protected currentRenderGroup: RenderGroupMap<
    Cacheable,
    DataType
  > | null = null;
  protected cacheIdsToRemove = new Set<string>();

  abstract removeCacheable(cacheable: Cacheable): void;

  renderGroup(groupName: string, renderBlock: () => void) {
    this.currentRenderGroup =
      this.groupToCacheIdToCacheable.get(groupName) ?? new Map();
    this.groupToCacheIdToCacheable.set(groupName, this.currentRenderGroup);
    this.cacheIdsToRemove.clear();

    for (const cacheKey of this.currentRenderGroup.keys()) {
      this.cacheIdsToRemove.add(cacheKey);
    }

    renderBlock();

    for (const cacheKey of this.cacheIdsToRemove.values()) {
      const {cacheable} = this.currentRenderGroup.get(cacheKey)!;
      this.removeCacheable(cacheable);
      this.currentRenderGroup.delete(cacheKey);
    }

    this.currentRenderGroup = null;
  }
}

export class SvgRenderer extends Renderer<SVGPathElement, Paths> {
  constructor(private readonly svg: SVGElement) {
    super();
  }

  removeCacheable(cacheable: SVGPathElement): void {
    this.svg.removeChild(cacheable);
  }

  onResize(rect: Rect) {}

  drawRect(cacheId: string, rect: Rect, color: string): void {
    throw new Error('Method not implemented.');
  }

  private createPathDString(paths: Paths): string {
    if (!paths.length) {
      return '';
    }

    const dBuilder: string[] = new Array(paths.length / 2);
    dBuilder[0] = `M${paths[0]},${paths[1]}`;
    for (let index = 1; index < paths.length / 2; index++) {
      dBuilder[index] = `L${paths[index * 2]},${paths[index * 2 + 1]}`;
    }
    return dBuilder.join('');
  }

  drawLine(id: string, paths: Paths, spec: LineSpec) {
    super.drawLine(id, paths, spec);

    if (paths.length < 2 || !this.currentRenderGroup) {
      return;
    }

    const {color, visible, width} = spec;

    const cache = this.currentRenderGroup.get(id);
    let path = cache?.cacheable;

    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.style.fill = 'none';
      this.svg.appendChild(path);
      this.currentRenderGroup.set(id, {cacheable: path, data: paths});
    }

    if (!cache?.data || !arePathsEqual(paths, cache?.data)) {
      const data = this.createPathDString(paths);
      path.setAttribute('d', data);
      this.currentRenderGroup.set(id, {cacheable: path, data: paths});
    }

    path.style.display = visible ? '' : 'none';
    path.style.stroke = color;
    path.style.strokeWidth = String(width);
  }

  drawText(id: string, text: string, spec: TextSpec): void {
    throw new Error('Method not implemented.');
  }

  render() {}
}

function areVectorsSame(
  vectorsA: THREE.Vector2[],
  vectorsB: THREE.Vector2[]
): boolean {
  if (vectorsA.length !== vectorsB.length) {
    return false;
  }

  for (let index = 0; index < vectorsA.length; index++) {
    if (
      vectorsA[index].x !== vectorsB[index].x ||
      vectorsA[index].y !== vectorsB[index].y
    ) {
      return false;
    }
  }
  return true;
}

export class Canvas3dRenderer extends Renderer<THREE.Object3D, any> {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly font = new THREE.FontLoader().parse(Roboto);

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    private readonly coordinator: THREECoordinator,
    devicePixelRatio: number
  ) {
    super();

    if (isOffscreenCanvasSupported() && canvas instanceof OffscreenCanvas) {
      // THREE.js require the style object which Offscreen canvas lacks.
      (canvas as any).style = (canvas as any).style || {};
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas as HTMLCanvasElement,
      context: canvas.getContext('webgl2', {
        antialias: true,
        precision: 'highp',
        alpha: true,
      }) as WebGLRenderingContext,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
  }

  onResize(rect: Rect) {
    this.renderer.setSize(rect.width, rect.height);
  }

  removeCacheable(cacheable: THREE.Object3D): void {
    this.scene.remove(cacheable);

    if (cacheable instanceof THREE.Mesh || cacheable instanceof THREE.Line) {
      cacheable.geometry.dispose();
      const materials = Array.isArray(cacheable.material)
        ? cacheable.material
        : [cacheable.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  }

  drawRect(cacheId: string, rect: Rect, color: string): void {
    super.drawRect(cacheId, rect, color);

    if (!this.currentRenderGroup) return;

    const cache = this.currentRenderGroup.get(cacheId);
    let mesh: THREE.Mesh | null = null;

    if (cache && cache.cacheable instanceof THREE.Mesh) {
      mesh = cache.cacheable;
    } else if (!cache) {
      const geometry = new THREE.BoxBufferGeometry(rect.width, rect.height, 1);
      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.FrontSide,
      });
      mesh = new THREE.Mesh(geometry, material);
      this.currentRenderGroup.set(cacheId, {data: null, cacheable: mesh});
      this.scene.add(mesh);
    }

    if (!mesh) {
      return;
    }

    const boxGeometry = mesh.geometry as THREE.BoxBufferGeometry;
    const material = mesh.material as THREE.MeshBasicMaterial;

    const newColor = new THREE.Color(color);
    if (!newColor.equals(material.color)) {
      material.color = newColor;
    }

    if (
      boxGeometry.parameters.width !== rect.width ||
      boxGeometry.parameters.height !== rect.height
    ) {
      mesh.geometry = new THREE.BoxBufferGeometry(rect.width, rect.height, 1);
    }

    mesh.position.x = rect.x - rect.width / 2;
    mesh.position.y = rect.y + rect.height / 2;
  }

  drawLine(id: string, paths: Paths, spec: LineSpec) {
    super.drawLine(id, paths, spec);

    if (!paths.length || !this.currentRenderGroup) {
      return;
    }

    const {visible, color, width} = spec;
    const opacity = spec.opacity ?? 1;
    const newD3Color = d3Color(color);
    const opacityAdjustedRgb = newD3Color
      ? (newD3Color.brighter(1 - opacity) as any).formatRgb()
      : '#aaa';
    const newColor = new THREE.Color(opacityAdjustedRgb);

    const cache = this.currentRenderGroup.get(id);
    let line: THREE.Line | null = null;
    if (cache && cache.cacheable instanceof THREE.Line) {
      line = cache.cacheable;
    }
    const prevVectors: THREE.Vector2[] | null = cache ? cache.data : null;

    if (line && Array.isArray(line.material)) {
      throw new Error('Invariant error: only expect one material on a line');
    }

    if (line) {
      const material = line.material as THREE.LineBasicMaterial;

      if (material.visible !== visible) {
        line.visible = visible;
        material.visible = visible;
        material.needsUpdate = true;
      }
      if (!visible) {
        return;
      }
    }

    const vectors = new Array<THREE.Vector2>(paths.length / 2);
    for (let index = 0; index < paths.length; index += 2) {
      vectors[index / 2] = new THREE.Vector2(paths[index], paths[index + 1]);
    }

    if (line) {
      const material = line.material as THREE.LineBasicMaterial;
      const currentColor = material.color;

      if (material.linewidth !== width) {
        material.linewidth = width;
        material.needsUpdate = true;
      }

      if (!currentColor.equals(newColor)) {
        material.color.set(newColor);
        material.needsUpdate = true;
      }

      if (!prevVectors || !areVectorsSame(prevVectors, vectors)) {
        this.updatePoints(line.geometry as THREE.BufferGeometry, vectors);
        this.currentRenderGroup.set(id, {
          data: vectors,
          cacheable: line,
        });
      }
    } else {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: newColor,
        linewidth: width,
      });
      line = new THREE.Line(geometry, material);
      this.currentRenderGroup.set(id, {
        data: vectors,
        cacheable: line,
      });
      material.visible = visible;
      geometry.setDrawRange(0, vectors.length);
      line.geometry.setFromPoints(vectors);
      this.scene.add(line);
    }
  }

  private updatePoints(
    lineGeometry: THREE.BufferGeometry,
    vectors: THREE.Vector2[]
  ) {
    let index = 0;
    const positionAttributes = lineGeometry.attributes
      .position as THREE.BufferAttribute;
    if (positionAttributes.count !== vectors.length * 3) {
      lineGeometry.setFromPoints(vectors);
    } else {
      const values = positionAttributes.array as number[];
      for (const vector of vectors) {
        values[index++] = vector.x;
        values[index++] = vector.y;
        values[index++] = 0;
      }
      (lineGeometry as any).dynamic = true;
      positionAttributes.needsUpdate = true;
    }
    lineGeometry.setDrawRange(0, vectors.length);
  }

  drawText(id: string, text: string, spec: TextSpec): void {
    super.drawText(id, text, spec);

    if (!this.currentRenderGroup) return;

    const cache = this.currentRenderGroup.get(id);

    let geometry: THREE.TextGeometry | null = null;
    let mesh: THREE.Mesh | null = null;

    const textGeometryConfig = {
      font: this.font,
      size: spec.size,
      height: 1,
      curveSegments: 10,
    };

    if (cache && cache.cacheable instanceof THREE.Mesh) {
      mesh = cache.cacheable;
      (mesh.material as THREE.MeshBasicMaterial).color.set(spec.color);
      const prevData = cache.data as {
        text: string;
        size: number;
      };
      if (prevData.text !== text || prevData.size !== spec.size) {
        geometry = new THREE.TextGeometry(text, textGeometryConfig);
        (mesh.geometry as THREE.Geometry).copy(geometry);
      }
    } else if (!cache) {
      geometry = new THREE.TextGeometry(text, textGeometryConfig);
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: false,
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotateZ(0);
      mesh.rotateX(Math.PI);

      this.scene.add(mesh);
      this.currentRenderGroup.set(id, {
        data: {text, size: spec.size},
        cacheable: mesh,
      });
    }

    if (mesh) {
      mesh.geometry.computeBoundingBox();

      switch (spec.horizontalAlign) {
        case TextAlign.START:
          mesh.position.x = spec.position.x;
          break;
        case TextAlign.CENTER: {
          const textSize = new THREE.Vector3();
          mesh.geometry.boundingBox.getSize(textSize);
          mesh.position.x = spec.position.x - textSize.x / 2;
          break;
        }
        case TextAlign.END: {
          const textSize = new THREE.Vector3();
          mesh.geometry.boundingBox.getSize(textSize);
          mesh.position.x = spec.position.x - textSize.x;
          break;
        }
      }
      switch (spec.verticalAlign) {
        case TextAlign.START: {
          const textSize = new THREE.Vector3();
          mesh.geometry.boundingBox.getSize(textSize);
          mesh.position.y = spec.position.y + textSize.y;
          break;
        }
        case TextAlign.CENTER: {
          const textSize = new THREE.Vector3();
          mesh.geometry.boundingBox.getSize(textSize);
          mesh.position.y = spec.position.y + textSize.y / 2;
          break;
        }
        case TextAlign.END: {
          const textSize = new THREE.Vector3();
          mesh.geometry.boundingBox.getSize(textSize);
          mesh.position.y = spec.position.y;
          break;
        }
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.coordinator.getCamera());
  }
}
