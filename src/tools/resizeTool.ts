// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, beforeSelectionPos, setBefore } from "../selection";
import {
  getSelectionHandleAtPoint,
  HandleType,
} from "../utils/selectionHitTest";
import {
  changeCanvasSize,
  getPixelRatio,
  position,
  to_pixel_canvas_coord,
} from "../position";

import { clamp } from "../utils/math";
import { dispatch } from "../events/pointerEvents";
import { pointers } from "../events/gestures";

export class ResizeTool {
  private activeHandle: HandleType | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime = 0;

  down(e: PointerEvent) {
    if (paintState.toolId !== "resize" || paintState.action !== "BRUSH") return;

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
      paintState.setToolId("brush");
      selection.setShowHint(false);
      selection.setShowHandle(false);
      this.activeHandle = null;
      dispatch(e, "down");
      return;
    }

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    if (this.activeHandle) {
      let { x, y, w, h } = this.start;
      const p = point;

      switch (this.activeHandle) {
        case "RB":
          w = p.x - x + 1;
          h = p.y - y + 1;
          break;

        case "RT":
          h = y + h - p.y;
          y = p.y;
          w = p.x - x + 1;
          break;

        case "LB":
          w = x + w - p.x;
          x = p.x;
          h = p.y - y + 1;
          break;

        case "LT":
          w = x + w - p.x;
          h = y + h - p.y;
          x = p.x;
          y = p.y;
          break;

        case "R":
          w = p.x - x + 1;
          break;

        case "L":
          w = x + w - p.x;
          x = p.x;
          break;

        case "B":
          h = p.y - y + 1;
          break;

        case "T":
          h = y + h - p.y;
          y = p.y;
          break;
      }

      if (e.shiftKey) {
        const ratio = this.start.w / this.start.h;
        const curRatio = w / h;
        if (curRatio < ratio) w = Math.floor(h * ratio);
        else h = Math.floor(w / ratio);
        if (["L", "LT", "LB"].includes(this.activeHandle))
          x = this.start.x + this.start.w - w;
        if (["T", "LT", "RT"].includes(this.activeHandle))
          y = this.start.y + this.start.h - h;
      }

      const min = 1,
        max = 4096;
      selection.setX(
        clamp(
          x,
          beforeSelectionPos.x + beforeSelectionPos.width - max,
          beforeSelectionPos.x + beforeSelectionPos.width - min
        )
      );
      selection.setY(
        clamp(
          y,
          beforeSelectionPos.y + beforeSelectionPos.height - max,
          beforeSelectionPos.y + beforeSelectionPos.height - min
        )
      );
      selection.setWidth(clamp(w, min, max));
      selection.setHeight(clamp(h, min, max));
    }
  }

  up() {
    if (
      pointers.size == 0 &&
      (this.activeHandle == "OUTSIDE" || this.activeHandle == "INSIDE")
    ) {
      // 이러면 롱 클릭할때만 현상유지임
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        paintState.setToolId("brush");
        selection.setShowHint(false);
        selection.setShowHandle(false);
      }
    } else {
      position.setX(position.x + selection.x / getPixelRatio());
      position.setY(position.y + selection.y / getPixelRatio());

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
