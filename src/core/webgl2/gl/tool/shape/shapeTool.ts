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

type LinePoints = {
  p1: Pointer;
  p2: Pointer;
  c1: Pointer | null;
  c2: Pointer | null;
};

const EMPTY_RECT: ShapeRect = { x: 0, y: 0, width: 0, height: 0 };

export function getShapeManager(canvas: OffscreenCanvas, gl: WebGL2RenderingContext) {
  return getManager(gl, "shapeManager", () => new ShapeManager(canvas, gl));
}

class ShapeManager {
  private readonly sourceTextureManager;
  private readonly layerManager;
  private readonly renderingManager;
  private readonly shapeTexture: WebGLTexture;
  private readonly rectangleModule;
  private readonly ellipseModule;
  private readonly lineModule;
  private readonly curveModule;
  private activeKind: ShapeKind | null = null;
  private shapeRect: ShapeRect | null = null;
  private beforeShapeRect: ShapeRect | null = null;
  private shapePos: ShapeRect = { ...EMPTY_RECT };
  private hasInitialHistory: boolean = false;
  private linePoints: LinePoints | null = null;

  constructor(
    private canvas: OffscreenCanvas,
    private gl: WebGL2RenderingContext,
  ) {
    this.sourceTextureManager = getSourceTextureManager(canvas, gl);
    this.layerManager = getLayerManager(canvas, gl);
    this.renderingManager = getRenderingManager(canvas, gl);

    this.shapeTexture = gl.createTexture()!;
    const shapeOptions = {
      imageTexture: this.sourceTextureManager.texture,
      resultTexture: this.layerManager.getLayerTex(paintOptions.layerId),
      shapeTexture: this.shapeTexture,
      width: paintOptions.width,
      height: paintOptions.height,
    };
    this.rectangleModule = createRectangle(gl, shapeOptions);
    this.ellipseModule = createEllipse(gl, shapeOptions);
    this.lineModule = createLineShape(gl, shapeOptions);
    this.curveModule = createCurveShape(gl, shapeOptions);
  }

  start(kind: ShapeKind) {
    const previousRect = this.hideShapePreview();
    this.activeKind = kind;
    this.shapeRect = null;
    this.beforeShapeRect = null;
    this.hasInitialHistory = false;
    this.linePoints = null;
    if (!isEmptyRect(previousRect)) {
      this.renderingManager.render(this.toAppRect(previousRect) ?? undefined);
    }
  }

  setRect(x: number, y: number, width: number, height: number) {
    if (this.activeKind !== "rect" && this.activeKind !== "ellipse") return;

    const rect = { x, y, width, height };

    if (!this.hasInitialHistory) {
      this.hasInitialHistory = true;
      const kind = this.activeKind;

      // Captures state at undo time so redo can restore the correct shape
      let redoState: { shapeRect: ShapeRect | null; beforeShapeRect: ShapeRect | null } | null = null;

      const history = new HistoryObject({
        undo: async () => {
          const previousRect = this.hideShapePreview();
          redoState = {
            shapeRect: this.shapeRect ? { ...this.shapeRect } : null,
            beforeShapeRect: this.beforeShapeRect ? { ...this.beforeShapeRect } : null,
          };
          this.activeKind = null;
          this.shapeRect = null;
          this.beforeShapeRect = null;
          this.hasInitialHistory = false;
          this.renderingManager.render(this.toAppRect(previousRect) ?? undefined);
          return { shape: this.getHiddenHistoryShape() };
        },
        redo: async () => {
          if (!redoState?.shapeRect) return { shape: this.getHiddenHistoryShape() };
          this.activeKind = kind;
          this.hasInitialHistory = true;
          // drawRectDraft re-creates the shape texture and sets showShape=true
          this.drawRectDraft(redoState.shapeRect);
          this.beforeShapeRect = redoState.beforeShapeRect;
          return { shape: this.getHistoryShape(true) };
        },
        byteSize: 0,
      });
      getHistoryManager(this.canvas, this.gl).addUndo(history);
    }

    this.drawRectDraft(rect);
    this.beforeShapeRect = { ...rect };
  }

  setLine(p1: Pointer, p2: Pointer, c1?: Pointer | null, c2?: Pointer | null) {
    if (this.activeKind !== "line" && this.activeKind !== "curve") return;

    // Always track latest endpoints so undo/redo can re-create the texture
    this.linePoints = { p1: { ...p1 }, p2: { ...p2 }, c1: c1 ? { ...c1 } : null, c2: c2 ? { ...c2 } : null };

    if (!this.hasInitialHistory) {
      this.hasInitialHistory = true;
      const kind = this.activeKind;

      // Captures state at undo time so redo can restore the correct shape
      let redoState: { linePoints: LinePoints | null } | null = null;

      const history = new HistoryObject({
        undo: async () => {
          const previousRect = this.hideShapePreview();
          redoState = { linePoints: this.linePoints ? cloneLinePoints(this.linePoints) : null };
          this.activeKind = null;
          this.shapeRect = null;
          this.beforeShapeRect = null;
          this.hasInitialHistory = false;
          this.linePoints = null;
          this.renderingManager.render(this.toAppRect(previousRect) ?? undefined);
          return { shape: this.getHiddenHistoryShape() };
        },
        redo: async () => {
          if (!redoState?.linePoints) return { shape: this.getHiddenHistoryShape() };
          this.activeKind = kind;
          this.hasInitialHistory = true;
          this.linePoints = cloneLinePoints(redoState.linePoints);
          // setLine re-creates the texture, sets showShape, and renders
          this.setLine(redoState.linePoints.p1, redoState.linePoints.p2, redoState.linePoints.c1, redoState.linePoints.c2);
          return { shape: this.getHistoryShape(true) };
        },
        byteSize: 0,
      });
      getHistoryManager(this.canvas, this.gl).addUndo(history);
    }

    const previousRect = this.hideShapePreview();
    this.applyOptions();
    const renderRect =
      this.activeKind === "curve"
        ? this.curveModule.create(p1, p2, c1 ?? null, c2 ?? null)
        : this.lineModule.create(p1, p2);

    this.shapePos = renderRect;
    paintOptions.showShape = !isEmptyRect(renderRect);
    this.renderUnion(previousRect, renderRect);
  }

  updateOptions() {
    if (!paintOptions.showShape) return;

    if (this.activeKind === "rect" || this.activeKind === "ellipse") {
      if (!this.shapeRect) return;
      this.drawRectDraft(this.shapeRect);
    } else if ((this.activeKind === "line" || this.activeKind === "curve") && this.linePoints) {
      const previousRect = this.hideShapePreview();
      this.applyOptions();
      const { p1, p2, c1, c2 } = this.linePoints;
      const renderRect =
        this.activeKind === "curve"
          ? this.curveModule.create(p1, p2, c1, c2)
          : this.lineModule.create(p1, p2);
      this.shapePos = renderRect;
      paintOptions.showShape = !isEmptyRect(renderRect);
      this.renderUnion(previousRect, renderRect);
    }
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
    if (!paintOptions.showShape || isEmptyRect(this.shapePos)) {
      this.clearDraft();
      return;
    }

    const renderRect = { ...this.shapePos };
    const appliedRect = this.applyDraft(renderRect);
    const rect = this.toAppRect(appliedRect);
    if (!rect || rect.isEmpty()) {
      this.clearDraft();
      this.renderingManager.render(this.toAppRect(renderRect) ?? undefined);
      return;
    }

    const { before, after } = this.sourceTextureManager.upload(rect.x, rect.y, rect.width, rect.height);

    // Capture all shape state before clearDraft wipes it
    const savedKind = this.activeKind;
    const savedShapeRect = this.shapeRect ? { ...this.shapeRect } : null;
    const savedBeforeShapeRect = this.beforeShapeRect ? { ...this.beforeShapeRect } : null;
    const savedShapePos = { ...this.shapePos };
    const savedLinePoints = this.linePoints ? cloneLinePoints(this.linePoints) : null;

    // The union area covers both the overlay position and the committed area
    const unionArea = this.toAppRect(this.unionRect(savedShapePos, appliedRect));

    const byteSize = rect.width * rect.height * 4 * 2;
    const history = new HistoryObject({
      undo: async () => {
        await before.apply();
        this.activeKind = savedKind;
        this.hasInitialHistory = true;

        if (savedKind === "rect" || savedKind === "ellipse") {
          // drawRectDraft re-creates the shape texture (cleared by applyDraft) and sets showShape=true
          this.drawRectDraft(savedShapeRect ?? savedShapePos);
          this.beforeShapeRect = savedBeforeShapeRect;
        } else {
          // Re-create line/curve texture
          this.linePoints = savedLinePoints;
          this.applyOptions();
          const { p1, p2, c1, c2 } = savedLinePoints!;
          const newRenderRect =
            savedKind === "curve"
              ? this.curveModule.create(p1, p2, c1, c2)
              : this.lineModule.create(p1, p2);
          this.shapePos = newRenderRect;
          paintOptions.showShape = !isEmptyRect(newRenderRect);
        }

        await this.renderingManager.render(unionArea ?? rect);
        return { shape: this.getHistoryShape(true) };
      },
      redo: async () => {
        await after.apply();
        this.clearDraft();
        await this.renderingManager.render(unionArea ?? rect);
        return { shape: this.getHiddenHistoryShape() };
      },
      byteSize,
    });

    getHistoryManager(this.canvas, this.gl).addUndo(history);
    this.clearDraft();
    this.renderingManager.render(this.toAppRect(this.unionRect(renderRect, appliedRect)) ?? rect);
  }

  discard() {
    const previousRect = this.hideShapePreview();
    this.clearDraft();
    this.renderingManager.render(this.toAppRect(previousRect) ?? undefined);
  }

  getPosition() {
    return {
      x: this.shapePos.x,
      y: this.shapePos.y,
      width: this.shapePos.width,
      height: this.shapePos.height,
    };
  }

  getTexture() {
    return this.shapeTexture;
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

    const previousRect = this.hideShapePreview();
    this.applyOptions();
    const renderRect =
      this.activeKind === "ellipse" ? this.ellipseModule.create(rect) : this.rectangleModule.create(rect);

    this.shapeRect = { ...rect };
    this.shapePos = renderRect;
    paintOptions.showShape = !isEmptyRect(renderRect);
    this.renderUnion(previousRect, renderRect);
  }

  private applyDraft(rect: ShapeRect): ShapeRect {
    if (this.activeKind === "rect") return this.rectangleModule.apply(rect);
    if (this.activeKind === "ellipse") return this.ellipseModule.apply(rect);
    if (this.activeKind === "line") return this.lineModule.apply(rect);
    if (this.activeKind === "curve") return this.curveModule.apply(rect);
    return { ...EMPTY_RECT };
  }

  private hideShapePreview() {
    const rect = paintOptions.showShape ? { ...this.shapePos } : { ...EMPTY_RECT };
    paintOptions.showShape = false;
    this.shapePos = { ...EMPTY_RECT };
    return rect;
  }

  private clearDraft() {
    paintOptions.showShape = false;
    this.activeKind = null;
    this.shapeRect = null;
    this.beforeShapeRect = null;
    this.shapePos = { ...EMPTY_RECT };
    this.hasInitialHistory = false;
    this.linePoints = null;
  }

  private getHistoryShape(show: boolean) {
    const rect = this.shapeRect ?? this.shapePos;
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

function cloneLinePoints(pts: LinePoints): LinePoints {
  return {
    p1: { ...pts.p1 },
    p2: { ...pts.p2 },
    c1: pts.c1 ? { ...pts.c1 } : null,
    c2: pts.c2 ? { ...pts.c2 } : null,
  };
}

function isEmptyRect(rect: ShapeRect) {
  return rect.width <= 0 || rect.height <= 0;
}

function isSameRect(a: ShapeRect, b: ShapeRect) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
