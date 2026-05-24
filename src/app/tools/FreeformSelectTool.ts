import { InputMode, paintState, ToolId } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { canvasFreeformSelect, selection } from "../selection";
import { clamp } from "../utils/math";
import type { Tool, ToolConfig } from "./Tool";

interface SelectionPoint {
  x: number;
  y: number;
}

export class FreeformSelectTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
    cursorClass: "select",
  };

  private active = false;
  private points: SelectionPoint[] = [];
  private lastPoint: SelectionPoint | null = null;

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getToolId() === ToolId.FreeformSelect
    );
  }

  down(e: PointerEvent) {
    if (!this.canUse()) return;

    const point = this.getPoint(e);
    this.points = [point];
    this.lastPoint = point;
    this.active = true;
    selection.startFreeformPreview(point);
  }

  move(e: PointerEvent) {
    if (!this.active || !paintState.getPointerdown()) return;
    if (!this.canUse()) return;

    const point = this.getPoint(e);
    if (!this.lastPoint || distance(this.lastPoint, point) >= 1) {
      this.points.push(point);
      this.lastPoint = point;
      selection.addFreeformPreviewPoint(point);
    }
  }

  up(e: PointerEvent) {
    if (!this.active) return;
    this.active = false;

    const point = this.getPoint(e);
    const lastPoint = this.points[this.points.length - 1];
    if (!lastPoint || lastPoint.x !== point.x || lastPoint.y !== point.y) {
      this.points.push(point);
    }

    const points = [...this.points];
    selection.clearFreeformPreview();
    canvasFreeformSelect(points);
    this.points = [];
    this.lastPoint = null;
  }

  cancel() {
    this.active = false;
    this.points = [];
    this.lastPoint = null;
    selection.clearFreeformPreview();
  }

  private getPoint(e: PointerEvent): SelectionPoint {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    return {
      x: clamp(point.x, 0, position.width - 1),
      y: clamp(point.y, 0, position.height - 1),
    };
  }
}

function distance(a: SelectionPoint, b: SelectionPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
