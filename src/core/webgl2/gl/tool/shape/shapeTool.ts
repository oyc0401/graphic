import type { Pointer, ShapeKind } from "@/core/types";
import { HistoryObject, getHistoryManager } from "@/core/history/history";
import { Rect } from "@/core/utils/rect";
import { getManager } from "@/core/utils/cachedManager";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createCurveShape } from "./curveShapeModule";
import { createEllipse } from "./ellipseModule";
import { createLineShape } from "./lineShapeModule";
import { createRectangle } from "./rectangleModule";

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
  private readonly rectangleModule;
  private readonly ellipseModule;
  private readonly lineModule;
  private readonly curveModule;
  private activeKind: ShapeKind | null = null;
  private shapeRect: ShapeRect | null = null;
  private beforeShapeRect: ShapeRect | null = null;
  private draftDirtyRect: ShapeRect | null = null;

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
    this.rectangleModule = createRectangle(gl, {
      ...options,
      shapeTexture: gl.createTexture()!,
    });
    this.ellipseModule = createEllipse(gl, {
      ...options,
      shapeTexture: gl.createTexture()!,
    });
    this.lineModule = createLineShape(gl, {
      ...options,
      shapeTexture: gl.createTexture()!,
    });
    this.curveModule = createCurveShape(gl, {
      ...options,
      shapeTexture: gl.createTexture()!,
    });
  }

  start(kind: ShapeKind) {
    const restoredRect = this.restoreDraft();
    this.activeKind = kind;
    this.shapeRect = null;
    this.beforeShapeRect = null;
    this.draftDirtyRect = null;
    if (restoredRect) {
      this.renderingManager.render(this.toAppRect(restoredRect) ?? undefined);
    }
  }

  setRect(x: number, y: number, width: number, height: number) {
    if (this.activeKind !== "rect" && this.activeKind !== "ellipse") return;

    const rect = { x, y, width, height };
    this.drawRectDraft(rect);
    this.beforeShapeRect = { ...rect };
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
        ? this.curveModule.create(p1, p2, c1 ?? null, c2 ?? null)
        : this.lineModule.create(p1, p2);

    this.draftDirtyRect = dirtyRect;
    this.renderUnion(restoredRect, dirtyRect);
  }

  transformRect(x: number, y: number, width: number, height: number) {
    if (this.activeKind !== "rect" && this.activeKind !== "ellipse") return;
    this.drawRectDraft({ x, y, width, height });
  }

  completeTransform() {
    if (!this.activeKind || !this.beforeShapeRect || !this.shapeRect) return;
    if (isSameRect(this.beforeShapeRect, this.shapeRect)) return;

    const beforePosition = { ...this.beforeShapeRect };
    const afterPosition = { ...this.shapeRect };
    const kind = this.activeKind;

    const history = new HistoryObject({
      undo: async () => {
        this.activeKind = kind;
        this.drawRectDraft(beforePosition);
        this.beforeShapeRect = { ...beforePosition };
        return { shape: this.getHistoryShape(true) };
      },
      redo: async () => {
        this.activeKind = kind;
        this.drawRectDraft(afterPosition);
        this.beforeShapeRect = { ...afterPosition };
        return { shape: this.getHistoryShape(true) };
      },
      byteSize: 0,
    });

    this.beforeShapeRect = { ...this.shapeRect };
    getHistoryManager(this.canvas, this.gl).addUndo(history);
  }

  apply() {
    const appliedRect = this.applyDraft(this.draftDirtyRect);
    const rect = this.toAppRect(appliedRect);
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
        return { shape: this.getHiddenHistoryShape() };
      },
      redo: async () => {
        await after.apply();
        await this.renderingManager.render(rect);
        return { shape: this.getHiddenHistoryShape() };
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

    this.rectangleModule.setColor(color);
    this.rectangleModule.setWidth(width);
    this.ellipseModule.setColor(color);
    this.ellipseModule.setWidth(width);
    this.lineModule.setColor(color);
    this.lineModule.setWidth(width);
    this.curveModule.setColor(color);
    this.curveModule.setWidth(width);
  }

  private drawRectDraft(rect: ShapeRect) {
    if (this.activeKind !== "rect" && this.activeKind !== "ellipse") return;

    const restoredRect = this.restoreDraft();
    this.applyOptions();
    const dirtyRect =
      this.activeKind === "ellipse"
        ? this.ellipseModule.create(rect)
        : this.rectangleModule.create(rect);

    this.shapeRect = { ...rect };
    this.draftDirtyRect = dirtyRect;
    this.renderUnion(restoredRect, dirtyRect);
  }

  private applyDraft(rect: ShapeRect | null): ShapeRect | null {
    if (!this.activeKind || !rect) return null;
    if (this.activeKind === "rect") return this.rectangleModule.apply(rect);
    if (this.activeKind === "ellipse") return this.ellipseModule.apply(rect);
    if (this.activeKind === "line") return this.lineModule.apply(rect);
    if (this.activeKind === "curve") return this.curveModule.apply(rect);
    return null;
  }

  private restoreDraft(): ShapeRect | null {
    const rect = this.draftDirtyRect;
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

    this.draftDirtyRect = null;
    return rect;
  }

  private clearDraft() {
    this.activeKind = null;
    this.shapeRect = null;
    this.beforeShapeRect = null;
    this.draftDirtyRect = null;
  }

  private getHistoryShape(show: boolean) {
    const rect = this.shapeRect ?? { x: 0, y: 0, width: 0, height: 0 };
    return {
      show,
      kind: this.activeKind,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  private getHiddenHistoryShape() {
    return {
      show: false,
      kind: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
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

function isSameRect(a: ShapeRect, b: ShapeRect) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}
