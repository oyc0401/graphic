import type { LiquifyTool, Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createLiquify } from "./liquifyModule";
import type { LiquifyRect } from "./liquifyModule";

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

export class LiquifyManager implements LiquifyManagerInterface {
  protected gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sourceTextureManager: any;
  private layerManager: any;
  private renderingManager: any;
  private liquify: ReturnType<typeof createLiquify> | null = null;
  private sourceDisplacementTexture: WebGLTexture | null = null;
  private displacementTexture: WebGLTexture | null = null;
  private toolId: LiquifyTool = "push";
  private changedRect: Rect | null = null;
  private active = false;

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

  private createLiquify() {
    this.sourceTextureManager.uploadFromLayer(paintOptions.layerId);
    const sourceDisplacementTexture = createDisplacementTexture(
      this.gl,
      paintOptions.width,
      paintOptions.height,
    );
    const displacementTexture = createDisplacementTexture(
      this.gl,
      paintOptions.width,
      paintOptions.height,
    );
    this.sourceDisplacementTexture = sourceDisplacementTexture;
    this.displacementTexture = displacementTexture;

    this.liquify = createLiquify(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      sourceDisplacementTexture,
      displacementTexture,
      width: paintOptions.width,
      height: paintOptions.height,
    });

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);
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
    if (!rect || rect.width === 0 || rect.height === 0) {
      return undefined;
    }
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  enter() {
    this.changedRect = null;
    this.createLiquify();
    this.active = true;
  }

  start(pointer: Pointer) {
    if (!this.liquify) return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);
    const rect =
      this.toolId === "restore"
        ? this.liquify.restoreStart(pointer)
        : this.liquify.start(pointer);
    this.markChanged(rect);
  }

  push(pointer: Pointer) {
    if (!this.liquify) return;
    if (this.toolId !== "push" && this.toolId !== "restore") return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);
    const rect =
      this.toolId === "restore"
        ? this.liquify.restoreMove(pointer)
        : this.liquify.move(pointer);
    this.markChanged(rect);
  }

  apply(pointer: Pointer) {
    if (!this.liquify) return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);

    const rect =
      this.toolId === "twirlClockwise"
        ? this.liquify.spin(pointer)
        : this.toolId === "twirlCounterClockwise"
          ? this.liquify.rightSpin(pointer)
          : this.toolId === "bloat"
          ? this.liquify.bloat(pointer)
          : this.toolId === "pucker"
            ? this.liquify.pucker(pointer)
            : null;

    this.markChanged(rect);
  }

  render() {
    if (!this.liquify) return;

    const rect = this.liquify.render();
    this.renderingManager.render(this.toAppRect(rect));
  }

  end() {
    if (!this.liquify) return;

    this.markChanged(this.liquify.end());
  }

  cancel() {
    if (!this.liquify) return;

    this.liquify.cancel();
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

    this.liquify?.destroy();
    this.liquify = null;
    this.destroyDisplacementTextures();
    this.active = false;
    this.changedRect = null;
  }

  discardSession() {
    if (!this.active) return;

    this.sourceTextureManager.restore();
    this.renderingManager.render();
    this.liquify?.destroy();
    this.liquify = null;
    this.destroyDisplacementTextures();
    this.active = false;
    this.changedRect = null;
  }

  setTool(toolId: LiquifyTool) {
    this.toolId = toolId;
  }

  setSize: () => void = () => {};

  private destroyDisplacementTextures() {
    if (this.sourceDisplacementTexture) {
      this.gl.deleteTexture(this.sourceDisplacementTexture);
    }
    if (this.displacementTexture) {
      this.gl.deleteTexture(this.displacementTexture);
    }
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
