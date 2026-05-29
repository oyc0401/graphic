import { paintConfig } from "@/paint.config";
import { InputMode, paintState } from "../paintState";
import { to_pixel_canvas_coord } from "../position";
import { applyShape, beforeShapePos, shape, shapeCancel } from "../shape";
import { clamp } from "../utils/math";
import {
  getShapeHandleAtPoint,
  type ShapeHandleType,
} from "../utils/shapeHitTest";
import {
  resizeShapeFromHandle,
  type ShapeResizeHandle,
} from "../utils/shapeResize";
import { getLayerWorker } from "../worker/workerPool";
import type { Tool, ToolConfig } from "./Tool";

export class ShapeTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private activeHandle: ShapeHandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime = 0;

  enter() {}

  exit() {
    if (shape.visible) {
      applyShape();
    }
    shape.setHover("default");
  }

  canUse() {
    return (
      shape.visible &&
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getSessionId() === null &&
      paintState.getTemporaryToolId() === null
    );
  }

  private hitTest(e: PointerEvent): ShapeHandleType {
    return getShapeHandleAtPoint(e.clientX, e.clientY, {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    });
  }

  private cursorForHandle(handle: ShapeHandleType) {
    switch (handle) {
      case "LT":
      case "RB":
        return "nwse-resize";
      case "RT":
      case "LB":
        return "nesw-resize";
      case "T":
      case "B":
        return "ns-resize";
      case "L":
      case "R":
        return "ew-resize";
      case "INSIDE":
        return "move";
      case "OUTSIDE":
        return "default";
    }
  }

  updateHover(e: PointerEvent, enabled: boolean) {
    if (!enabled) {
      shape.setHover("default");
      return;
    }

    shape.setHover(this.cursorForHandle(this.hitTest(e)));
  }

  down(e: PointerEvent) {
    if (!this.canUse()) return;
    if (!paintState.getPointerdown()) return;

    const handle = this.hitTest(e);
    this.activeHandle = handle;
    this.start = {
      x: shape.x,
      y: shape.y,
      w: shape.width,
      h: shape.height,
    };

    if (handle === "INSIDE") {
      const point = to_pixel_canvas_coord(e.clientX, e.clientY);
      this.dragOffset = {
        x: point.x - shape.x,
        y: point.y - shape.y,
      };
      shape.active = true;
    } else if (handle === "OUTSIDE") {
      this.startTime = performance.now();
    } else {
      shape.active = true;
    }
  }

  move(e: PointerEvent) {
    if (!paintState.getPointerdown()) return;

    this.applyShapeDrag(e);
  }

  private applyShapeDrag(e: PointerEvent) {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);

    if (this.activeHandle === "INSIDE") {
      if (!shape.active) return;

      shape.setShowHandle(false);
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      shape.setPosition(newX, newY);

      getLayerWorker().transformShape(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
      );
    } else if (this.activeHandle && this.activeHandle !== "OUTSIDE") {
      const resized = resizeShapeFromHandle({
        startRect: {
          x: this.start.x,
          y: this.start.y,
          width: this.start.w,
          height: this.start.h,
        },
        handle: this.activeHandle as ShapeResizeHandle,
        pointer: point,
        keepRatio: e.shiftKey,
      });
      const min = 1;
      const max = paintConfig.maxSize;
      shape.setX(resized.x);
      shape.setY(resized.y);
      shape.setWidth(clamp(resized.width, min, max));
      shape.setHeight(clamp(resized.height, min, max));

      getLayerWorker().transformShape(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
      );
    }
  }

  up(e: PointerEvent) {
    if (!this.activeHandle) return;
    if (this.activeHandle !== "OUTSIDE") {
      this.applyShapeDrag(e);
    }

    if (this.activeHandle === "INSIDE") {
      beforeShapePos.x = shape.x;
      beforeShapePos.y = shape.y;
      beforeShapePos.width = shape.width;
      beforeShapePos.height = shape.height;
      shape.setShowHandle(true);
    }
    if (!paintState.getPointerdown() && this.activeHandle === "OUTSIDE") {
      const now = performance.now();
      if (now - this.startTime < 150) {
        applyShape();
      }
    }

    if (this.activeHandle !== "OUTSIDE") {
      getLayerWorker().completeTransformShape();
      beforeShapePos.x = shape.x;
      beforeShapePos.y = shape.y;
      beforeShapePos.width = shape.width;
      beforeShapePos.height = shape.height;
      shape.setShowHandle(true);
    }

    shape.active = false;
    this.activeHandle = null;
    shape.setHover("default");
  }

  cancel() {
    shapeCancel();
    shape.setHover("default");
    this.activeHandle = null;
  }
}

export const shapeTool = new ShapeTool();
