import { colorState } from "../colorState";
import { InputMode, paintState, ToolId } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { createShape, discardShape, shape, toCoreShapeKind } from "../shape";
import { clamp } from "../utils/math";
import { getLayerWorker } from "../worker/workerPool";
import type { Tool, ToolConfig } from "./Tool";

export class ShapeCreateTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
    cursorClass: "select",
  };

  private startPoint: { x: number; y: number };
  private endPoint: { x: number; y: number };
  private active = false;

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getToolId() === ToolId.Shape &&
      paintState.getSessionId() === null &&
      paintState.getTemporaryToolId() === null
    );
  }

  down(e: PointerEvent) {
    if (!this.canUse()) return;

    const point = this.getPoint(e);
    this.startPoint = point;
    this.endPoint = point;
    this.active = true;

    const shapeId = paintState.getShapeId();
    shape.setKind(shapeId);
    shape.setRect(point.x, point.y, 1, 1);
    shape.setVisible(false);
    shape.setShowHint(true);
    shape.setShowHandle(false);

    const worker = getLayerWorker();
    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    const { r, g, b } = colorState.getRGB();
    worker.setStrokeColor(r, g, b);
    worker.startShape(toCoreShapeKind(shapeId));
  }

  move(e: PointerEvent) {
    if (!this.active || !paintState.getPointerdown()) return;
    if (!this.canUse()) return;

    this.endPoint = this.getPoint(e);
    const rect = getDragRect(this.startPoint, this.endPoint);

    shape.setRect(rect.x, rect.y, rect.width, rect.height);
    shape.setShowHint(true);
    shape.setShowHandle(false);
    getLayerWorker().setRectShape(rect.x, rect.y, rect.width, rect.height);
  }

  up(e: PointerEvent) {
    if (!this.active) return;
    this.active = false;

    this.endPoint = this.getPoint(e);
    const rect = getDragRect(this.startPoint, this.endPoint);

    if (rect.width === 1 && rect.height === 1) {
      discardShape();
      return;
    }

    getLayerWorker().setRectShape(rect.x, rect.y, rect.width, rect.height);
    createShape(paintState.getShapeId(), rect.x, rect.y, rect.width, rect.height);
  }

  cancel() {
    this.active = false;
    discardShape();
  }

  private getPoint(e: PointerEvent) {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    return {
      x: clamp(point.x, 0, position.width - 1),
      y: clamp(point.y, 0, position.height - 1),
    };
  }
}

function getDragRect(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
) {
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  const width = Math.abs(startPoint.x - endPoint.x) + 1;
  const height = Math.abs(startPoint.y - endPoint.y) + 1;

  return { x, y, width, height };
}
