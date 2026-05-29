import type { MosaicMode, Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createMosaic } from "./mosaicModule";
import type { MosaicRect } from "./mosaicModule";

interface MosaicManagerInterface {
  enter(): void;
  start(pointer: Pointer): void;
  push(pointer: Pointer): void;
  render(): void;
  end(): void;
  cancel(): void;
  undo(): Promise<any>;
  redo(): Promise<any>;
  getHistoryCount(): { undoCount: number; redoCount: number };
  exit(): void;
  applySession(): void;
  discardSession(): void;
  setMode(mode: MosaicMode): void;
  setStrength(strength: number): void;
  setSize: () => void;
}

export class MosaicManager implements MosaicManagerInterface {
  protected gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sourceTextureManager: any;
  private layerManager: any;
  private renderingManager: any;
  private mosaic: ReturnType<typeof createMosaic> | null = null;
  private sourceMaskTexture: WebGLTexture | null = null;
  private maskTexture: WebGLTexture | null = null;
  private changedRect: Rect | null = null;
  private active = false;
  private mode: Exclude<MosaicMode, "restore"> = "pixel";
  private restoring = false;
  private strength = 0.5;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
  }

  static async create(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ): Promise<MosaicManager> {
    const manager = new MosaicManager(canvas, gl);
    manager.initializeResources();
    return manager;
  }

  private initializeResources() {
    this.sourceTextureManager = getSourceTextureManager(this.canvas, this.gl);
    this.layerManager = getLayerManager(this.canvas, this.gl);
    this.renderingManager = getRenderingManager(this.canvas, this.gl);
  }

  private createMosaic() {
    this.sourceTextureManager.uploadFromLayer(paintOptions.layerId);
    const sourceMaskTexture = createMaskTexture(
      this.gl,
      paintOptions.width,
      paintOptions.height,
    );
    const maskTexture = createMaskTexture(
      this.gl,
      paintOptions.width,
      paintOptions.height,
    );
    this.sourceMaskTexture = sourceMaskTexture;
    this.maskTexture = maskTexture;

    this.mosaic = createMosaic(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      sourceMaskTexture,
      maskTexture,
      width: paintOptions.width,
      height: paintOptions.height,
    });

    this.mosaic.setRadius(paintOptions.radius);
    this.mosaic.setMode(this.mode);
    if (this.restoring) {
      this.mosaic.setMode("restore");
    }
    this.mosaic.setStrength(this.strength);
  }

  private markChanged(rect: MosaicRect | null) {
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const appRect = Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
    if (!this.changedRect) {
      this.changedRect = appRect;
      return;
    }

    const left = Math.min(this.changedRect.x, appRect.x);
    const top = Math.min(this.changedRect.y, appRect.y);
    const right = Math.max(this.changedRect.right, appRect.right);
    const bottom = Math.max(this.changedRect.bottom, appRect.bottom);
    this.changedRect = Rect.fromWidth(left, top, right - left, bottom - top);
  }

  private toAppRect(rect: MosaicRect | null): Rect | undefined {
    if (!rect || rect.width === 0 || rect.height === 0) {
      return undefined;
    }
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  enter() {
    this.changedRect = null;
    this.createMosaic();
    this.active = true;
  }

  start(pointer: Pointer) {
    if (!this.mosaic) return;

    this.mosaic.setRadius(paintOptions.radius);
    this.markChanged(this.mosaic.start(pointer));
  }

  push(pointer: Pointer) {
    if (!this.mosaic) return;

    this.mosaic.setRadius(paintOptions.radius);
    const rect = this.mosaic.move(pointer);
    this.markChanged(rect);
  }

  render() {
    if (!this.mosaic) return;

    const rect = this.mosaic.render();
    this.markChanged(rect);
    this.renderingManager.render(this.toAppRect(rect));
  }

  end() {
    if (!this.mosaic) return;

    this.markChanged(this.mosaic.end());
  }

  cancel() {
    if (!this.mosaic) return;

    this.mosaic.cancel();
    this.render();
  }

  async undo() {
    return null;
  }

  async redo() {
    return null;
  }

  getHistoryCount() {
    return { undoCount: 0, redoCount: 0 };
  }

  exit() {
    this.applySession();
  }

  applySession() {
    if (!this.active) return;

    const gl = this.gl;
    const historyManager = getHistoryManager(this.canvas, gl);

    if (this.changedRect) {
      const changedRect = Rect.copy(this.changedRect);
      const { before: beforeSource, after: afterSource } =
        this.sourceTextureManager.upload(
          changedRect.x,
          changedRect.y,
          changedRect.width,
          changedRect.height,
        );

      const sourceBytes = changedRect.width * changedRect.height * 4 * 2;
      const self = this;
      const newHistory = new HistoryObject({
        undo: async () => {
          await beforeSource.apply();
          self.renderingManager.render(changedRect);
          return {};
        },
        redo: async () => {
          await afterSource.apply();
          self.renderingManager.render(changedRect);
          return {};
        },
        byteSize: sourceBytes,
      });

      historyManager.addUndo(newHistory);
    }

    this.mosaic?.destroy();
    this.mosaic = null;
    this.destroyMaskTextures();
    this.active = false;
    this.changedRect = null;
  }

  discardSession() {
    if (!this.active) return;

    this.sourceTextureManager.restore();
    this.renderingManager.render();
    this.mosaic?.destroy();
    this.mosaic = null;
    this.destroyMaskTextures();
    this.active = false;
    this.changedRect = null;
  }

  setMode(mode: MosaicMode) {
    if (mode === "restore") {
      this.restoring = true;
      this.mosaic?.setMode(mode);
      return;
    }

    this.restoring = false;
    this.mode = mode;
    if (!this.mosaic) return;

    this.mosaic.setMode(mode);
    this.render();
  }

  setStrength(strength: number) {
    this.strength = Math.max(0, Math.min(1, strength));
    if (!this.mosaic) return;

    this.mosaic.setStrength(this.strength);
    this.render();
  }

  setSize: () => void = () => {};

  private destroyMaskTextures() {
    if (this.sourceMaskTexture) {
      this.gl.deleteTexture(this.sourceMaskTexture);
    }
    if (this.maskTexture) {
      this.gl.deleteTexture(this.maskTexture);
    }
    this.sourceMaskTexture = null;
    this.maskTexture = null;
  }
}

function createMaskTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
