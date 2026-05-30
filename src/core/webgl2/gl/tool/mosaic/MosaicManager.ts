import type { MosaicMode, Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { PixelStore } from "../../../../history/PixelStore";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { mosaicMaskModule } from "./mosaicModule/maskModule";
import type { MosaicRect } from "./mosaicModule/maskModule";
import { mosaicRenderModule } from "./mosaicModule/renderModule";

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

interface StrokeHistory {
  rect: MosaicRect;
  before: PixelStore<Uint8Array>;
  after: PixelStore<Uint8Array>;
}

export class MosaicManager implements MosaicManagerInterface {
  protected gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sourceTextureManager: any;
  private layerManager: any;
  private renderingManager: any;

  private mask: ReturnType<typeof mosaicMaskModule> | null = null;
  private renderModule: ReturnType<typeof mosaicRenderModule> | null = null;

  private sourceMaskTexture: WebGLTexture | null = null;
  private maskTexture: WebGLTexture | null = null;
  private sourceMaskFBO: WebGLFramebuffer | null = null;
  private maskFBO: WebGLFramebuffer | null = null;

  private pendingRect: MosaicRect | null = null;
  private allStrokesRect: MosaicRect | null = null;
  private changedRect: Rect | null = null;
  private active = false;

  private restoring = false;
  private mode: Exclude<MosaicMode, "restore"> = "pixel";
  private strength = 0.5;

  private strokeHistory: StrokeHistory[] = [];
  private historyIndex = -1;

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

  private createModules() {
    this.sourceTextureManager.uploadFromLayer(paintOptions.layerId);

    const width = paintOptions.width;
    const height = paintOptions.height;

    const sourceMaskTexture = createMaskTexture(this.gl, width, height);
    const maskTexture = createMaskTexture(this.gl, width, height);
    this.sourceMaskTexture = sourceMaskTexture;
    this.maskTexture = maskTexture;

    this.sourceMaskFBO = createFramebuffer(this.gl, sourceMaskTexture);
    this.maskFBO = createFramebuffer(this.gl, maskTexture);

    this.mask = mosaicMaskModule(this.gl, {
      sourceMaskTexture,
      maskTexture,
      width,
      height,
    });

    this.renderModule = mosaicRenderModule(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      maskTexture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      width,
      height,
    });

    this.renderModule.setStrength(this.strength);
    this.renderModule.setMode(this.mode);
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
    if (!rect || rect.width === 0 || rect.height === 0) return undefined;
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  private unionRect(a: MosaicRect | null, b: MosaicRect | null): MosaicRect | null {
    if (!a) return b;
    if (!b) return a;
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private readMaskPixels(fbo: WebGLFramebuffer, rect: MosaicRect): Uint8Array {
    const gl = this.gl;
    const pixels = new Uint8Array(rect.width * rect.height);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RED, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  private writeMaskPixels(texture: WebGLTexture, rect: MosaicRect, pixels: Uint8Array) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0,
      rect.x, rect.y, rect.width, rect.height,
      gl.RED, gl.UNSIGNED_BYTE, pixels,
    );
  }

  private commitMaskToSource(rect: MosaicRect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.maskFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sourceMaskFBO);
    gl.blitFramebuffer(
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );
  }

  private revertMaskFromSource(rect: MosaicRect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceMaskFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.maskFBO);
    gl.blitFramebuffer(
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );
  }

  enter() {
    this.changedRect = null;
    this.allStrokesRect = null;
    this.strokeHistory = [];
    this.historyIndex = -1;
    this.createModules();
    this.active = true;
  }

  start(pointer: Pointer) {
    if (!this.mask) return;

    this.mask.setRadius(paintOptions.radius);
    this.pendingRect = this.restoring
      ? this.mask.restoreStart(pointer)
      : this.mask.start(pointer);
  }

  push(pointer: Pointer) {
    if (!this.mask) return;

    this.mask.setRadius(paintOptions.radius);
    this.pendingRect = this.restoring
      ? this.mask.restoreMove(pointer)
      : this.mask.move(pointer);
  }

  render() {
    if (!this.renderModule) return;

    const rect = this.pendingRect;
    this.pendingRect = null;
    if (rect) this.renderModule.render(rect);
    this.renderingManager.render(this.toAppRect(rect));
  }

  end() {
    if (!this.mask) return;

    const strokeRect = this.mask.end();
    if (!strokeRect || strokeRect.width === 0 || strokeRect.height === 0) return;

    const before = PixelStore.fromPixelData(this.readMaskPixels(this.sourceMaskFBO!, strokeRect), strokeRect.width, strokeRect.height);
    this.commitMaskToSource(strokeRect);
    const after = PixelStore.fromPixelData(this.readMaskPixels(this.sourceMaskFBO!, strokeRect), strokeRect.width, strokeRect.height);

    this.strokeHistory = this.strokeHistory.slice(0, this.historyIndex + 1);
    this.strokeHistory.push({ rect: strokeRect, before, after });
    this.historyIndex++;

    this.allStrokesRect = this.unionRect(this.allStrokesRect, strokeRect);
    this.markChanged(strokeRect);
  }

  cancel() {
    if (!this.mask) return;

    const strokeRect = this.mask.end();
    if (!strokeRect || strokeRect.width === 0 || strokeRect.height === 0) return;

    this.revertMaskFromSource(strokeRect);
    this.pendingRect = strokeRect;
    this.render();
  }

  async undo() {
    if (this.historyIndex < 0) return null;

    const entry = this.strokeHistory[this.historyIndex];
    this.historyIndex--;

    this.writeMaskPixels(this.sourceMaskTexture!, entry.rect, entry.before.getPixelData());
    this.writeMaskPixels(this.maskTexture!, entry.rect, entry.before.getPixelData());
    this.pendingRect = entry.rect;
    this.render();
    return this.getHistoryCount();
  }

  async redo() {
    if (this.historyIndex >= this.strokeHistory.length - 1) return null;

    this.historyIndex++;
    const entry = this.strokeHistory[this.historyIndex];

    this.writeMaskPixels(this.sourceMaskTexture!, entry.rect, entry.after.getPixelData());
    this.writeMaskPixels(this.maskTexture!, entry.rect, entry.after.getPixelData());
    this.pendingRect = entry.rect;
    this.render();
    return this.getHistoryCount();
  }

  getHistoryCount() {
    return {
      undoCount: this.historyIndex + 1,
      redoCount: this.strokeHistory.length - 1 - this.historyIndex,
    };
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

    this.destroyModules();
    this.active = false;
    this.changedRect = null;
  }

  discardSession() {
    if (!this.active) return;

    this.sourceTextureManager.restore();
    this.renderingManager.render();
    this.destroyModules();
    this.active = false;
    this.changedRect = null;
  }

  setMode(mode: MosaicMode) {
    if (mode === "restore") {
      this.restoring = true;
      return;
    }

    this.restoring = false;
    this.mode = mode;

    if (!this.renderModule) return;
    this.renderModule.setMode(mode);
    this.pendingRect = this.allStrokesRect;
    this.render();
  }

  setStrength(strength: number) {
    this.strength = Math.max(0, Math.min(1, strength));

    if (!this.renderModule) return;
    this.renderModule.setStrength(this.strength);
    this.pendingRect = this.allStrokesRect;
    this.render();
  }

  setSize: () => void = () => {};

  private destroyModules() {
    this.mask?.destroy();
    this.mask = null;
    this.renderModule?.destroy();
    this.renderModule = null;
    this.destroyMaskTextures();
    this.strokeHistory = [];
    this.historyIndex = -1;
    this.allStrokesRect = null;
  }

  private destroyMaskTextures() {
    const gl = this.gl;
    if (this.sourceMaskFBO) gl.deleteFramebuffer(this.sourceMaskFBO);
    if (this.maskFBO) gl.deleteFramebuffer(this.maskFBO);
    if (this.sourceMaskTexture) gl.deleteTexture(this.sourceMaskTexture);
    if (this.maskTexture) gl.deleteTexture(this.maskTexture);
    this.sourceMaskFBO = null;
    this.maskFBO = null;
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture) {
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0,
  );
  return framebuffer;
}
