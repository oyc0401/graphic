import type { Pointer, ShapeKind } from "@/core/types";
import { HistoryObject, getHistoryManager } from "@/core/history/history";
import { Rect } from "@/core/utils/rect";
import { getManager } from "@/core/utils/cachedManager";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createCurveShape } from "./curveShapeModule";
import { createLineShape } from "./lineShapeModule";
import { createShape } from "./shapeModule";

type ShapeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getShapeManager(
  canvas: OffscreenCanvas,
  gl: WebGL2RenderingContext,
) {
  return getManager(gl, "shapeManager", () => new ShapeManager(canvas, gl));
}

class ShapeManager {
  private readonly sourceTextureManager;
  private readonly layerManager;
  private readonly renderingManager;
  private readonly shapeModule;
  private readonly lineModule;
  private readonly curveModule;
  private activeKind: ShapeKind | null = null;
  private draftRect: ShapeRect | null = null;

  constructor(
    private canvas: OffscreenCanvas,
    private gl: WebGL2RenderingContext,
  ) {
    this.sourceTextureManager = getSourceTextureManager(canvas, gl);
    this.layerManager = getLayerManager(canvas, gl);
    this.renderingManager = getRenderingManager(canvas, gl);

    const options = {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      width: paintOptions.width,
      height: paintOptions.height,
    };
    this.shapeModule = createShape(gl, options);
    this.lineModule = createLineShape(gl, options);
    this.curveModule = createCurveShape(gl, options);
  }

  start(kind: ShapeKind) {
    const restoredRect = this.restoreDraft();
    this.activeKind = kind;
    this.draftRect = null;
    if (restoredRect) {
      this.renderingManager.render(this.toAppRect(restoredRect) ?? undefined);
    }
  }

  setRect(x: number, y: number, width: number, height: number) {
    if (this.activeKind !== "rect" && this.activeKind !== "ellipse") return;

    const restoredRect = this.restoreDraft();
    this.applyOptions();
    const rect = { x, y, width, height };
    const dirtyRect =
      this.activeKind === "ellipse"
        ? this.shapeModule.createEllipse(rect)
        : this.shapeModule.createRectangle(rect);

    this.draftRect = dirtyRect;
    this.renderUnion(restoredRect, dirtyRect);
  }

  setLine(
    p1: Pointer,
    p2: Pointer,
    c1?: Pointer | null,
    c2?: Pointer | null,
  ) {
    if (this.activeKind !== "line" && this.activeKind !== "curve") return;

    const restoredRect = this.restoreDraft();
    this.applyOptions();
    const dirtyRect =
      this.activeKind === "curve"
        ? this.curveModule.createCurve(p1, p2, c1 ?? null, c2 ?? null)
        : this.lineModule.createLine(p1, p2);

    this.draftRect = dirtyRect;
    this.renderUnion(restoredRect, dirtyRect);
  }

  apply() {
    const rect = this.toAppRect(this.draftRect);
    if (!rect || rect.isEmpty()) {
      this.clearDraft();
      return;
    }

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
    this.clearDraft();
    this.renderingManager.render(rect);
  }

  discard() {
    const restoredRect = this.restoreDraft();
    this.clearDraft();
    this.renderingManager.render(this.toAppRect(restoredRect) ?? undefined);
  }

  private applyOptions() {
    const color: [number, number, number, number] = [
      paintOptions.color[0],
      paintOptions.color[1],
      paintOptions.color[2],
      paintOptions.alpha,
    ];
    const width = paintOptions.radius * 2;

    this.shapeModule.setColor(color);
    this.shapeModule.setWidth(width);
    this.lineModule.setColor(color);
    this.lineModule.setWidth(width);
    this.curveModule.setColor(color);
    this.curveModule.setWidth(width);
  }

  private restoreDraft(): ShapeRect | null {
    const rect = this.draftRect;
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    this.gl.bindFramebuffer(
      this.gl.READ_FRAMEBUFFER,
      this.sourceTextureManager.sourceFBO,
    );
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, this.layerManager.layerFBO);
    this.gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.NEAREST,
    );

    this.draftRect = null;
    return rect;
  }

  private clearDraft() {
    this.activeKind = null;
    this.draftRect = null;
  }

  private renderUnion(a: ShapeRect | null, b: ShapeRect | null) {
    const rect = this.unionRect(a, b);
    this.renderingManager.render(this.toAppRect(rect) ?? undefined);
  }

  private unionRect(a: ShapeRect | null, b: ShapeRect | null): ShapeRect | null {
    if (!a) return b;
    if (!b) return a;

    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  private toAppRect(rect: ShapeRect | null): Rect | null {
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }
}
