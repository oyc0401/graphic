import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { getLayerManager } from "../../layer";
import { getManager } from "../../../../utils/cachedManager";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { Rect } from "@/core/utils/rect";
import type { Pointer } from "@/core/types";
import { createBrush } from "./brushModule";
import type { BrushRect } from "./brushModule";
import type { BrushMode } from "./brushModule";

export enum StrokeType {
  Spline = "spline",
  Dist = "dist",
  Pencil = "pencil",
}

export function getBrushManager(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
) {
  const manager = getManager(
    gl,
    "brushManager",
    () => new BrushManager(canvas, gl),
  );
  return manager;
}

class BrushManager {
  private sourceTextureManager;
  private layerManager;
  private renderingManager;
  private strokeType = StrokeType.Spline;
  private mode: BrushMode = "brush";
  private brushModule: ReturnType<typeof createBrush>;

  constructor(
    canvas: HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
  ) {
    this.sourceTextureManager = getSourceTextureManager(canvas, gl);
    this.layerManager = getLayerManager(canvas, gl);
    this.renderingManager = getRenderingManager(canvas, gl);
    this.brushModule = this.createBrush();
  }

  setMode(nextMode: BrushMode) {
    this.mode = nextMode;
  }

  setStrokeType(type: StrokeType) {
    this.strokeType = type;
  }

  start(pointer: Pointer) {
    this.applyOptions();
    this.brushModule.start(pointer);
    this.renderingManager.render();
  }

  stroke(_start: Pointer, end: Pointer) {
    this.brushModule.move(end);
    this.renderingManager.render();
  }

  brush() {}

  eraser() {}

  end(toolId: "brush" | "eraser") {
    this.mode = toolId === "eraser" ? "eraser" : "brush";
    this.brushModule.setMode(this.mode);
    const strokeRect = this.brushModule.end();
    const renderRect = this.toAppRect(strokeRect);
    this.commitHistory(strokeRect);
    this.renderingManager.render(renderRect ?? undefined);
  }

  cancel() {
    this.brushModule.cancel();
    this.renderingManager.render();
  }

  setSize() {
    this.brushModule = this.createBrush();
  }

  private createBrush() {
    return createBrush(this.gl, {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      width: paintOptions.width,
      height: paintOptions.height,
    });
  }

  private applyOptions() {
    this.brushModule.setMode(this.mode);
    this.brushModule.setStrokeType(this.strokeType);
    this.brushModule.setAlpha(paintOptions.alpha);
    this.brushModule.setBrushSize(paintOptions.radius * 2);
    this.brushModule.setColor([
      paintOptions.color[0],
      paintOptions.color[1],
      paintOptions.color[2],
    ]);
  }

  private commitHistory(brushRect: BrushRect | null) {
    const rect = this.toAppRect(brushRect);
    if (!rect || rect.isEmpty()) return;

    const { before, after } = this.sourceTextureManager.upload(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    const byteSize = rect.width * rect.height * 4 * 2;
    const history = new HistoryObject({
      undo: async () => {
        await before.apply();
        await this.renderingManager.render(rect);
        return {};
      },
      redo: async () => {
        await after.apply();
        await this.renderingManager.render(rect);
        return {};
      },
      byteSize,
    });

    getHistoryManager(this.canvas, this.gl).addUndo(history);
  }

  private toAppRect(rect: BrushRect | null): Rect | null {
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }
}
