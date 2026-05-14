// tools/SelectionTool.ts
import { paintConfig } from "@/paint.config";
import { InputMode, paintState, ToolId } from "../paintState";
import { to_pixel_canvas_coord } from "../position";
import { applySelection, beforeSelectionPos, selection } from "../selection";
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

export class SelectionTool {
  private activeHandle: HandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0, flipH: false, flipV: false };

  private startTime;

  down(e: PointerEvent) {
    if (
      paintState.getToolId() !== ToolId.Selection ||
      paintState.getInputMode() !== InputMode.DEFAULT
    )
      return;
    if (!paintState.getPointerdown()) return;

    // console.log("point!!:", this.startPoint, this.endPoint);

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const handle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
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
    // el.container의 커서를 grab으로, paintState.getPointerdown()이면 grabbing으로
    // 그리고 핸들 범위에 올라가면, nesw-resize이런 4개방향 화살표로.

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const hoveredHandle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    switch (hoveredHandle) {
      case "LT":
      case "RB":
        selection.setHover("nwse-resize");
        break;
      case "RT":
      case "LB":
        selection.setHover("nesw-resize");
        break;
      case "T":
      case "B":
        selection.setHover("ns-resize");
        break;
      case "L":
      case "R":
        selection.setHover("ew-resize");
        break;
      case "INSIDE":
        selection.setHover("move");
        break;
      case "OUTSIDE":
        selection.setHover("default");
        break;
    }

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
  }
}

export const selectionTool = new SelectionTool();
