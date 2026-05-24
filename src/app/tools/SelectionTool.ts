// tools/SelectionTool.ts
import { paintConfig } from "@/paint.config";
import { InputMode, paintState, ToolId } from "../paintState";
import { to_pixel_canvas_coord } from "../position";
import {
  applySelection,
  beforeSelectionPos,
  selection,
  selectionCancel,
} from "../selection";
import { clamp } from "../utils/math";
import {
  getSelectionHandleAtPoint,
  type HandleType,
} from "../utils/selectionHitTest";
import {
  resizeSelectionFromHandle,
  type SelectionResizeHandle,
} from "../utils/selectionResize";
import { getLayerWorker } from "../worker/workerPool";
import { applyWorkerToolTarget } from "../coreToolAdapter";
import type { Tool, ToolConfig } from "./Tool";

export class SelectionTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private activeHandle: HandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0, flipH: false, flipV: false };

  private startTime;

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getToolId() === ToolId.Selection &&
      paintState.getInputMode() === InputMode.DEFAULT
    );
  }

  private hitTest(e: PointerEvent): HandleType {
    return getSelectionHandleAtPoint(e.clientX, e.clientY, {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    });
  }

  private cursorForHandle(handle: HandleType) {
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
      selection.setHover("default");
      return;
    }

    selection.setHover(this.cursorForHandle(this.hitTest(e)));
  }

  down(e: PointerEvent) {
    if (!this.canUse()) return;
    if (!paintState.getPointerdown()) return;

    // console.log("point!!:", this.startPoint, this.endPoint);

    const handle = this.hitTest(e);
    this.activeHandle = handle;
    this.start = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
      flipH: selection.flipH,
      flipV: selection.flipV,
    };

    console.log("handle:", handle);
    if (handle === "INSIDE") {
      const point = to_pixel_canvas_coord(e.clientX, e.clientY);
      this.dragOffset = {
        x: point.x - selection.x,
        y: point.y - selection.y,
      };
      selection.active = true;
    } else if (handle === "OUTSIDE") {
      this.startTime = performance.now();
    } else {
      selection.active = true;
    }
  }

  move(e: PointerEvent) {
    if (!paintState.getPointerdown()) return;

    this.applySelectionDrag(e);
  }

  private applySelectionDrag(e: PointerEvent) {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);

    if (this.activeHandle === "INSIDE") {
      if (!selection.active) return;

      selection.setShowHandle(false);
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      selection.setPosition(newX, newY);

      getLayerWorker().transformSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        selection.flipH,
        selection.flipV,
      );
    } else if (this.activeHandle && this.activeHandle !== "OUTSIDE") {
      const resized = resizeSelectionFromHandle({
        startRect: {
          x: this.start.x,
          y: this.start.y,
          width: this.start.w,
          height: this.start.h,
        },
        handle: this.activeHandle as SelectionResizeHandle,
        pointer: point,
        keepRatio: e.shiftKey,
        startFlipH: this.start.flipH,
        startFlipV: this.start.flipV,
      });
      const min = 1;
      const max = paintConfig.maxSize;
      selection.setX(resized.x);
      selection.setY(resized.y);
      selection.setWidth(clamp(resized.width, min, max));
      selection.setHeight(clamp(resized.height, min, max));
      selection.setFlip(resized.flipH, resized.flipV);

      getLayerWorker().transformSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        resized.flipH,
        resized.flipV,
      );
    }
  }

  up(e: PointerEvent) {
    if (!this.activeHandle) return;
    if (this.activeHandle !== "OUTSIDE") {
      this.applySelectionDrag(e);
    }

    if (this.activeHandle === "INSIDE") {
      beforeSelectionPos.x = selection.x;
      beforeSelectionPos.y = selection.y;
      beforeSelectionPos.width = selection.width;
      beforeSelectionPos.height = selection.height;
      selection.setShowHandle(true);
    }
    if (!paintState.getPointerdown() && this.activeHandle === "OUTSIDE") {
      const now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        applyWorkerToolTarget(ToolId.Select);
      }
    }

    if (this.activeHandle !== "OUTSIDE") {
      const worker = getLayerWorker();
      worker.completeTransformSelection();
    }

    selection.active = false;
    this.activeHandle = null;
    selection.setHover("default");
  }

  cancel() {
    selectionCancel();
    selection.setHover("default");
    this.activeHandle = null;
  }
}

export const selectionTool = new SelectionTool();
