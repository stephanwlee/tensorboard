import * as THREE from 'three';

import {THREECoordinator} from './coordinator';
import {Roboto} from './fonts/roboto';
import {LineSpec, Renderer, TextAlign, TextSpec} from './renderer_types';
import {Paths, Rect} from './types';

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

export class SvgRenderer implements Renderer {
  private idToPath = new Map<string, SVGPathElement>();
  private idToPaths = new Map<string, Paths>();

  constructor(private readonly svg: SVGElement) {}

  onResize(rect: Rect) {}

  resetRect(rect: Rect) {}

  drawRect(id: string, rect: Rect, color: string): void {}

  clearForTesting() {}

  renderGroup(groupName: string, renderBlock: () => void) {}

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

  drawLine(id: string, paths: Paths, {color, visible, width}: LineSpec) {
    if (paths.length < 2) {
      return;
    }

    const cachedPaths = this.idToPaths.get(id);
    let path = this.idToPath.get(id);

    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.style.fill = 'none';
      this.idToPath.set(id, path);
    }

    if (!cachedPaths || !arePathsEqual(paths, cachedPaths)) {
      path.setAttribute('d', this.createPathDString(paths));
      this.idToPaths.set(id, paths);
      this.svg.appendChild(path);
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

export class Canvas2dRenderer implements Renderer {
  private readonly context:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  constructor(
    private readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    private readonly devicePixelRatio: number
  ) {
    this.context = canvas.getContext('2d', {
      alpha: false,
    })!;
  }

  onResize(rect: Rect) {
    this.canvas.width = rect.width * this.devicePixelRatio;
    this.canvas.height = rect.height * this.devicePixelRatio;
    this.context.scale(this.devicePixelRatio, this.devicePixelRatio);
  }

  resetRect(rect: Rect) {
    this.context.fillStyle = '#fff';
    this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  drawRect(id: string, rect: Rect, color: string): void {}

  clearForTesting() {
    this.resetRect({x: 0, y: 0, width: 1000, height: 1000});
    if ((self as any).gc) {
      (self as any).gc();
    }
  }

  renderGroup(groupName: string, renderBlock: () => void) {}

  drawLine(id: string, paths: Paths, {color, width, visible}: LineSpec) {
    if (paths.length < 2 || !visible) {
      return;
    }

    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(paths[0], paths[1]);
    for (let i = 2; i < paths.length; i += 2) {
      ctx.lineTo(paths[i], paths[i + 1]);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  drawText(id: string, text: string, spec: TextSpec): void {
    throw new Error('Method not implemented.');
  }

  render() {}
}

export class Canvas3dRenderer implements Renderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly idsToRemove = new Set<string>();
  private readonly groupToCacheIdToThreeObject = new Map<
    string,
    Map<
      string,
      {
        data: any;
        object: THREE.Object3D;
      }
    >
  >();
  private currentRenderGroup: Map<
    string,
    {
      data: any;
      object: THREE.Object3D;
    }
  > | null = null;

  private readonly font = new THREE.FontLoader().parse(Roboto);

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    private readonly coordinator: THREECoordinator,
    devicePixelRatio: number
  ) {
    if (canvas instanceof OffscreenCanvas) {
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

  resetRect(rect: Rect) {}

  drawRect(id: string, rect: Rect, color: string): void {
    if (!this.currentRenderGroup) return;
    this.idsToRemove.delete(id);

    const cache = this.currentRenderGroup.get(id);
    let mesh: THREE.Mesh | null = null;

    if (cache && cache.object instanceof THREE.Mesh) {
      mesh = cache.object;
    } else if (!cache) {
      const geometry = new THREE.BoxBufferGeometry(rect.width, rect.height, 1);
      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.FrontSide,
      });
      mesh = new THREE.Mesh(geometry, material);
      this.currentRenderGroup.set(id, {data: null, object: mesh});
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

  /**
   * When trying to simulate initial render, we need to remove and re-create all
   * objects in the scene. Doing that in the re-render will cause large GC and
   * increased GPU memory usage.
   */
  clearForTesting() {
    this.groupToCacheIdToThreeObject.clear();
    while (this.scene.children.length) {
      this.scene.remove(this.scene.children[0]);
    }

    if ((self as any).gc) {
      (self as any).gc();
    }
  }

  renderGroup(groupName: string, renderBlock: () => void) {
    this.currentRenderGroup =
      this.groupToCacheIdToThreeObject.get(groupName) ?? new Map();
    this.groupToCacheIdToThreeObject.set(groupName, this.currentRenderGroup);
    this.idsToRemove.clear();

    for (const cacheKey of this.currentRenderGroup.keys()) {
      this.idsToRemove.add(cacheKey);
    }

    renderBlock();

    for (const cacheKey of this.idsToRemove.values()) {
      const {object} = this.currentRenderGroup.get(cacheKey)!;
      this.currentRenderGroup.delete(cacheKey);
      this.scene.remove(object);

      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          material.dispose();
        }
      }
    }

    this.currentRenderGroup = null;
  }

  private areVectorsSame(
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

  drawLine(id: string, paths: Paths, {visible, color, width}: LineSpec) {
    if (!paths.length) {
      return;
    }

    if (!this.currentRenderGroup) return;
    this.idsToRemove.delete(id);

    const cache = this.currentRenderGroup.get(id);
    let line: THREE.Line | null = null;
    if (cache && cache.object instanceof THREE.Line) {
      line = cache.object;
    }
    const prevVectors: THREE.Vector2[] | null = cache ? cache.data : null;

    if (line && Array.isArray(line.material)) {
      throw new Error('Invariant error: only expect one material on a line');
    }

    if (line) {
      const material = line.material as THREE.LineBasicMaterial;

      if (material.visible !== visible) {
        material.visible = visible;
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
      const newColor = new THREE.Color(color);

      if (material.visible !== visible) {
        material.visible = visible;
        material.needsUpdate = true;
      }

      if (material.linewidth !== width) {
        material.linewidth = width;
        material.needsUpdate = true;
      }

      if (!currentColor.equals(newColor)) {
        (line.geometry as any).dynamic = true;
        material.color.set(newColor);
        material.needsUpdate = true;
      }

      if (!prevVectors || !this.areVectorsSame(prevVectors, vectors)) {
        this.updatePoints(line.geometry as THREE.BufferGeometry, vectors);
        this.currentRenderGroup.set(id, {
          data: vectors,
          object: line,
        });
      }
    } else {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: width,
      });
      line = new THREE.Line(geometry, material);
      this.currentRenderGroup.set(id, {
        data: vectors,
        object: line,
      });
      this.scene.add(line);

      (line.material as THREE.LineBasicMaterial).color.set(color);
      line.visible = visible;
      geometry.setDrawRange(0, vectors.length);
      line.geometry.setFromPoints(vectors);
    }
  }

  private updatePoints(
    lineGeometry: THREE.BufferGeometry,
    vectors: THREE.Vector2[]
  ) {
    let index = 0;
    const positionAttributes = lineGeometry.attributes
      .position as THREE.BufferAttribute;
    const values = positionAttributes.array as number[];
    for (const vector of vectors) {
      values[index++] = vector.x;
      values[index++] = vector.y;
      values[index++] = 0;
    }
    (lineGeometry as any).dynamic = true;
    positionAttributes.needsUpdate = true;
    lineGeometry.setDrawRange(0, vectors.length);
  }

  drawText(id: string, text: string, spec: TextSpec): void {
    if (!this.currentRenderGroup) return;
    this.idsToRemove.delete(id);

    const cache = this.currentRenderGroup.get(id);

    let geometry: THREE.TextGeometry | null = null;
    let mesh: THREE.Mesh | null = null;

    const textGeometryConfig = {
      font: this.font,
      size: spec.size,
      height: 1,
      curveSegments: 10,
    };

    if (cache && cache.object instanceof THREE.Mesh) {
      mesh = cache.object;
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
        object: mesh,
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
