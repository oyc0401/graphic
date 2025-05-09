// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, beforeSelectionPos, applySelection } from "../selection";
import {
  getSelectionHandleAtPoint,
  HandleType,
} from "../utils/selectionHitTest";
import { to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import { clamp } from "../utils/math";

export class SelectionTool {
  private activeHandle: HandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime;

  down(e: PointerEvent) {
    if (paintState.toolId !== "selection" || paintState.action !== "BRUSH")
      return;
    if (!paintState.pointerdown) return;

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
    // el.container의 커서를 grab으로, paintState.pointerdown이면 grabbing으로
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

    if (!paintState.pointerdown) return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);

    if (this.activeHandle === "INSIDE") {
      if (!selection.active) return;

      selection.setShowHandle(false);
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      selection.setPosition(newX, newY);

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    } else if (this.activeHandle && this.activeHandle !== "OUTSIDE") {
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
          beforeSelectionPos.x + beforeSelectionPos.width - min,
        ),
      );
      selection.setY(
        clamp(
          y,
          beforeSelectionPos.y + beforeSelectionPos.height - max,
          beforeSelectionPos.y + beforeSelectionPos.height - min,
        ),
      );
      selection.setWidth(clamp(w, min, max));
      selection.setHeight(clamp(h, min, max));

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    }
  }

  up() {
    if (!this.activeHandle) return;
    if (this.activeHandle === "INSIDE") {
      beforeSelectionPos.x = selection.x;
      beforeSelectionPos.y = selection.y;
      beforeSelectionPos.width = selection.width;
      beforeSelectionPos.height = selection.height;
      selection.setShowHandle(true);
    }
    if (!paintState.pointerdown && this.activeHandle == "OUTSIDE") {
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        paintState.setToolId("select");
      }
    }

    if (this.activeHandle != "OUTSIDE") {
      const worker = getLayerWorker();
      worker.endMove();
    }

    selection.active = false;
    this.activeHandle = null;
  }
}

export const selectionTool = new SelectionTool();
