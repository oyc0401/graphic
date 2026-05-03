// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, setBefore } from "../selection";
import {
  getSelectionHandleAtPoint,
  HandleType,
} from "../utils/selectionHitTest";
import {
  resizeSelectionFromHandle,
  type SelectionResizeHandle,
} from "../utils/selectionResize";
import {
  changeCanvasSize,
  to_pixel_canvas_coord,
} from "../position";

import { clamp } from "../utils/math";
import { dispatch } from "../events/pointerEvents";
import { paintConfig } from "@/paint.config";
import { setCoreTool } from "../coreToolState";

export class ResizeTool {
  private activeHandle: HandleType | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime = 0;

  down(e: PointerEvent) {
    if (paintState.toolId !== "resize" || paintState.inputMode !== "BRUSH") return;

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
    setBefore({
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    });

    const handle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    this.activeHandle = handle;
    this.start = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
    };
    console.log("handle:", handle);

    if (handle === "OUTSIDE" || this.activeHandle === "INSIDE") {
      this.startTime = performance.now();
    } else {
      selection.active = true;
    }
  }

  move(e: PointerEvent) {
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
      case "OUTSIDE":
        selection.setHover("default");
        break;
    }

    if (!paintState.pointerdown) return;

    // 크기 조정 안하려고 하면 브러시로 이동
    if (this.activeHandle === "OUTSIDE" || this.activeHandle === "INSIDE") {
      setCoreTool("brush");
      selection.setShowHint(false);
      selection.setShowHandle(false);
      this.activeHandle = null;
      dispatch(e, "down");
      return;
    }

    this.updateResizeFromPointer(e);
  }

  private updateResizeFromPointer(e: PointerEvent) {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    if (this.activeHandle) {
      const min = 1,
        max = paintConfig.maxSize;
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
        allowFlip: false,
      });
      const width = clamp(resized.width, min, max);
      const height = clamp(resized.height, min, max);
      const x = this.activeHandle.includes("L")
        ? this.start.x + this.start.w - width
        : resized.x;
      const y = this.activeHandle.includes("T")
        ? this.start.y + this.start.h - height
        : resized.y;

      selection.setX(x);
      selection.setY(y);
      selection.setWidth(width);
      selection.setHeight(height);
    }
  }

  up(e: PointerEvent) {
    if (!this.activeHandle) {
    } else if (
      !paintState.pointerdown &&
      (this.activeHandle == "OUTSIDE" || this.activeHandle == "INSIDE")
    ) {
      // 이러면 롱 클릭할때만 현상유지임
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        setCoreTool("brush");
        selection.setShowHint(false);
        selection.setShowHandle(false);
      }
    } else {
      this.updateResizeFromPointer(e);
      let x = selection.x;
      let y = selection.y;

      selection.setX(0);
      selection.setY(0);
      console.log("resize!!!");
      changeCanvasSize(x, y, selection.width, selection.height);
    }

    selection.active = false;
    this.activeHandle = null;
  }
}

export const resizeTool = new ResizeTool();
