import type { LiquifyTool, Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { PixelStore } from "../../../../history/PixelStore";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createLiquifyDisplacement } from "./liquifyModule/displacementModule";
import type { LiquifyRect } from "./liquifyModule/displacementModule";
import { LiquifyRenderModule } from "./liquifyModule/renderModule";

interface LiquifyManagerInterface {
  enter(): void;
  start: (pointer: Pointer) => void;
  push: (pointer: Pointer) => void;
  apply: (pointer: Pointer) => void;
  render: () => void;
  end(): void;
  cancel(): void;
  undo(): Promise<any>;
  redo(): Promise<any>;
  getHistoryCount(): { undoCount: number; redoCount: number };
  exit(): void;
  applySession(): void;
  discardSession(): void;
  setTool(toolId: LiquifyTool): void;
  setSize: () => void;
}

interface StrokeHistory {
  rect: LiquifyRect;
  before: PixelStore<Float32Array>;
  after: PixelStore<Float32Array>;
}

export class LiquifyManager implements LiquifyManagerInterface {
  protected gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sourceTextureManager: any;
  private layerManager: any;
  private renderingManager: any;

  private displacement: ReturnType<typeof createLiquifyDisplacement> | null =
    null;
  private renderModule: ReturnType<typeof LiquifyRenderModule> | null = null;

  private sourceDisplacementTexture: WebGLTexture | null = null;
  private displacementTexture: WebGLTexture | null = null;
  private sourceDisplacementFBO: WebGLFramebuffer | null = null;
  private displacementFBO: WebGLFramebuffer | null = null;

  private toolId: LiquifyTool = "push";
  private pendingRect: LiquifyRect | null = null;
  private changedRect: Rect | null = null;
  private active = false;

  private strokeHistory: StrokeHistory[] = [];
  private historyIndex = -1;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
  }

  static async create(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ): Promise<LiquifyManager> {
    const manager = new LiquifyManager(canvas, gl);
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

    const sourceDisplacementTexture = createDisplacementTexture(
      this.gl,
      width,
      height,
    );
    const displacementTexture = createDisplacementTexture(
      this.gl,
      width,
      height,
    );
    this.sourceDisplacementTexture = sourceDisplacementTexture;
    this.displacementTexture = displacementTexture;

    this.sourceDisplacementFBO = createFramebuffer(
      this.gl,
      sourceDisplacementTexture,
    );
    this.displacementFBO = createFramebuffer(this.gl, displacementTexture);

    this.displacement = createLiquifyDisplacement(this.gl, {
      sourceDisplacementTexture,
      displacementTexture,
      width,
      height,
    });

    this.renderModule = LiquifyRenderModule(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      displacementTexture,
      width,
      height,
    });
  }

  private markChanged(rect: LiquifyRect | null) {
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

  private toAppRect(rect: LiquifyRect | null): Rect | undefined {
    if (!rect || rect.width === 0 || rect.height === 0) return undefined;
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  private readDisplacementPixels(
    fbo: WebGLFramebuffer,
    rect: LiquifyRect,
  ): Float32Array {
    const gl = this.gl;
    const pixels = new Float32Array(rect.width * rect.height * 2);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    gl.readPixels(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.FLOAT,
      pixels,
    );
    return pixels;
  }

  private writeDisplacementPixels(
    texture: WebGLTexture,
    rect: LiquifyRect,
    pixels: Float32Array,
  ) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.FLOAT,
      pixels,
    );
  }

  private commitDisplacementToSource(rect: LiquifyRect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.displacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sourceDisplacementFBO);
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  private revertDisplacementFromSource(rect: LiquifyRect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.displacementFBO);
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  enter() {
    this.changedRect = null;
    this.strokeHistory = [];
    this.historyIndex = -1;
    this.createModules();
    this.active = true;
  }

  start(pointer: Pointer) {
    if (!this.displacement) return;

    this.displacement.setRadius(paintOptions.radius);
    this.displacement.setStrength(paintOptions.alpha);
    this.pendingRect =
      this.toolId === "restore"
        ? this.displacement.restoreStart(pointer)
        : this.displacement.start(pointer);
  }

  push(pointer: Pointer) {
    if (!this.displacement) return;
    if (this.toolId !== "push" && this.toolId !== "restore") return;

    this.displacement.setRadius(paintOptions.radius);
    this.displacement.setStrength(paintOptions.alpha);
    this.pendingRect =
      this.toolId === "restore"
        ? this.displacement.restoreMove(pointer)
        : this.displacement.move(pointer);
  }

  apply(pointer: Pointer) {
    if (!this.displacement) return;

    this.displacement.setRadius(paintOptions.radius);
    this.displacement.setStrength(paintOptions.alpha);
    this.pendingRect =
      this.toolId === "twirlClockwise"
        ? this.displacement.spin(pointer)
        : this.toolId === "twirlCounterClockwise"
          ? this.displacement.rightSpin(pointer)
          : this.toolId === "bloat"
            ? this.displacement.bloat(pointer)
            : this.toolId === "pucker"
              ? this.displacement.pucker(pointer)
              : null;
  }

  render() {
    if (!this.renderModule) return;

    const rect = this.renderModule.render(this.pendingRect);
    this.pendingRect = null;
    this.renderingManager.render(this.toAppRect(rect));
  }

  end() {
    if (!this.displacement) return;

    const strokeRect = this.displacement.end();
    if (!strokeRect || strokeRect.width === 0 || strokeRect.height === 0)
      return;

    const before = PixelStore.fromPixelData(
      this.readDisplacementPixels(this.sourceDisplacementFBO!, strokeRect),
      strokeRect.width,
      strokeRect.height,
    );
    this.commitDisplacementToSource(strokeRect);
    const after = PixelStore.fromPixelData(
      this.readDisplacementPixels(this.sourceDisplacementFBO!, strokeRect),
      strokeRect.width,
      strokeRect.height,
    );

    this.strokeHistory = this.strokeHistory.slice(0, this.historyIndex + 1);
    this.strokeHistory.push({ rect: strokeRect, before, after });
    this.historyIndex++;

    this.markChanged(strokeRect);
  }

  cancel() {
    if (!this.displacement) return;

    const strokeRect = this.displacement.end();
    if (!strokeRect || strokeRect.width === 0 || strokeRect.height === 0)
      return;

    this.revertDisplacementFromSource(strokeRect);
    this.pendingRect = strokeRect;
    this.render();
  }

  async undo() {
    if (this.historyIndex < 0) return null;

    const entry = this.strokeHistory[this.historyIndex];
    this.historyIndex--;

    this.writeDisplacementPixels(
      this.sourceDisplacementTexture!,
      entry.rect,
      entry.before.getPixelData(),
    );
    this.writeDisplacementPixels(
      this.displacementTexture!,
      entry.rect,
      entry.before.getPixelData(),
    );
    this.pendingRect = entry.rect;
    this.render();
    return this.getHistoryCount();
  }

  async redo() {
    if (this.historyIndex >= this.strokeHistory.length - 1) return null;

    this.historyIndex++;
    const entry = this.strokeHistory[this.historyIndex];

    this.writeDisplacementPixels(
      this.sourceDisplacementTexture!,
      entry.rect,
      entry.after.getPixelData(),
    );
    this.writeDisplacementPixels(
      this.displacementTexture!,
      entry.rect,
      entry.after.getPixelData(),
    );
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

  setTool(toolId: LiquifyTool) {
    this.toolId = toolId;
  }

  setSize: () => void = () => {};

  private destroyModules() {
    this.displacement?.destroy();
    this.displacement = null;
    this.renderModule?.destroy();
    this.renderModule = null;
    this.destroyDisplacementTextures();
    this.strokeHistory = [];
    this.historyIndex = -1;
  }

  private destroyDisplacementTextures() {
    const gl = this.gl;
    if (this.sourceDisplacementFBO)
      gl.deleteFramebuffer(this.sourceDisplacementFBO);
    if (this.displacementFBO) gl.deleteFramebuffer(this.displacementFBO);
    if (this.sourceDisplacementTexture)
      gl.deleteTexture(this.sourceDisplacementTexture);
    if (this.displacementTexture) gl.deleteTexture(this.displacementTexture);
    this.sourceDisplacementFBO = null;
    this.displacementFBO = null;
    this.sourceDisplacementTexture = null;
    this.displacementTexture = null;
  }
}

function createDisplacementTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RG32F,
    width,
    height,
    0,
    gl.RG,
    gl.FLOAT,
    null,
  );
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
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  return framebuffer;
}
