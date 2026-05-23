import type { LiquifyTool } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createLiquify } from "./liquifyModule";
import type { LiquifyRect } from "./liquifyModule";

interface LiquifyManagerInterface {
  enter(): void;
  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  apply: (pointer: any) => void;
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

    this.liquify = createLiquify(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
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

  start(pointer: any) {
    if (!this.liquify) return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);
    this.liquify.start(pointer);
  }

  push(_start: any, end: any) {
    if (!this.liquify || this.toolId !== "push") return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);
    const rect = this.liquify.move(end);
    this.markChanged(rect);
  }

  apply(pointer: any) {
    if (!this.liquify) return;

    this.liquify.setRadius(paintOptions.radius);
    this.liquify.setStrength(paintOptions.alpha);

    const rect =
      this.toolId === "twirlClockwise"
        ? this.liquify.spin(pointer)
        : this.toolId === "twirlCounterClockwise"
          ? this.liquify.rightSpin(pointer)
          : null;

    this.markChanged(rect);
  }

  render() {
    if (!this.liquify) return;

    const rect = this.liquify.render();
    this.renderingManager.render(this.toAppRect(rect));
  }

  end() {
    this.liquify?.makeHistory();
  }

  cancel() {
    if (!this.liquify) return;

    this.liquify.cancel();
    this.render();
  }

  async undo() {
    if (!this.liquify) return null;

    this.liquify.undo();
    this.render();
    return {};
  }

  async redo() {
    if (!this.liquify) return null;

    this.liquify.redo();
    this.render();
    return {};
  }

  getHistoryCount() {
    return this.liquify?.getHistoryCount() ?? { undoCount: 0, redoCount: 0 };
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
    this.active = false;
    this.changedRect = null;
  }

  discardSession() {
    if (!this.active) return;

    this.sourceTextureManager.restore();
    this.renderingManager.render();
    this.liquify?.destroy();
    this.liquify = null;
    this.active = false;
    this.changedRect = null;
  }

  setTool(toolId: LiquifyTool) {
    this.toolId = toolId;
  }

  setSize: () => void = () => {};
}
