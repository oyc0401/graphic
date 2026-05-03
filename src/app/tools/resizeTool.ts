// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection } from "../selection";
import { HandleType } from "../utils/selectionHitTest";
import {
  resizeSelectionFromHandle,
  type SelectionResizeHandle,
} from "../utils/selectionResize";
import {
  changeCanvasSize,
  getPixelRatio,
  position,
  to_canvas_coord,
} from "../position";

import { clamp } from "../utils/math";
import { paintConfig } from "@/paint.config";

export const RESIZE_HANDLE_SIZE_PX = 7;
const RESIZE_HANDLE_EDGE_OFFSET_PX = Math.floor(RESIZE_HANDLE_SIZE_PX / 2);

export class ResizeTool {
  private activeHandle: HandleType | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private pointer = { clientX: 0, clientY: 0 };

  isVisible() {
    return (
      this.isActive() ||
      (!paintState.pointerdown && this.canUseCanvasResizeHandle())
    );
  }

  isActive() {
    return this.activeHandle !== null;
  }

  private canUseCanvasResizeHandle() {
    return (
      paintState.inputMode === "BRUSH" &&
      (paintState.coreTool === "brush" || paintState.coreTool === "eraser")
    );
  }

  getHandleRect() {
    if (this.isActive()) {
      return {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
      };
    }

    return this.getCanvasRect();
  }

  getActiveHandle() {
    return this.activeHandle;
  }

  getPointer() {
    return this.pointer;
  }

  private getCanvasRect() {
    return {
      x: 0,
      y: 0,
      width: position.width,
      height: position.height,
    };
  }

  private hitTestOutsideCanvasResizeHandle(
    clientX: number,
    clientY: number,
    margin = 22,
  ): HandleType {
    const dpr = getPixelRatio();
    const left = (position.x * position.scale) / dpr;
    const top =
      (position.y * position.scale) / dpr +
      position.bouncingRect.y -
      position.bottomNavHeight;
    const width = (position.width * position.scale) / dpr;
    const height = (position.height * position.scale) / dpr;
    const right = left + width;
    const bottom = top + height;

    const inRect = (
      x: number,
      y: number,
      rect: { x: number; y: number; w: number; h: number },
    ) =>
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h;

    const m = margin;
    const corners = {
      LT: { x: left - m, y: top - m, w: m, h: m },
      RT: { x: right, y: top - m, w: m, h: m },
      RB: { x: right, y: bottom, w: m, h: m },
      LB: { x: left - m, y: bottom, w: m, h: m },
    } as const;

    for (const key of ["LT", "RT", "RB", "LB"] as const) {
      if (inRect(clientX, clientY, corners[key])) return key;
    }

    return "OUTSIDE";
  }

  canStart(e: PointerEvent) {
    if (!this.canUseCanvasResizeHandle()) return false;
    const handle = this.hitTestOutsideCanvasResizeHandle(e.clientX, e.clientY);
    return handle !== "OUTSIDE" && handle !== "INSIDE";
  }

  down(e: PointerEvent) {
    if (!this.canStart(e)) return;

    const rect = this.getCanvasRect();

    const handle = this.hitTestOutsideCanvasResizeHandle(e.clientX, e.clientY);
    this.activeHandle = handle;
    this.pointer = { clientX: e.clientX, clientY: e.clientY };
    selection.setX(rect.x);
    selection.setY(rect.y);
    selection.setWidth(rect.width);
    selection.setHeight(rect.height);
    selection.setShowHint(true);
    selection.setShowHandle(false);
    selection.active = true;
    this.start = {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };
    console.log("handle:", handle);
  }

  move(e: PointerEvent) {
    if (this.isActive()) {
      this.pointer = { clientX: e.clientX, clientY: e.clientY };
    }

    const hoveredHandle = this.isVisible()
      ? this.hitTestOutsideCanvasResizeHandle(e.clientX, e.clientY)
      : "OUTSIDE";
    switch (hoveredHandle) {
      case "LT":
      case "RB":
        selection.setHover("nwse-resize");
        break;
      case "RT":
      case "LB":
        selection.setHover("nesw-resize");
        break;
      case "INSIDE":
      case "OUTSIDE":
      case "T":
      case "B":
      case "L":
      case "R":
        selection.setHover("default");
        break;
    }

    if (!paintState.pointerdown || !this.isActive()) return;

    this.updateResizeFromPointer(e);
  }

  private updateResizeFromPointer(e: PointerEvent) {
    const point = this.toResizeEdgePoint(e);
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

  private toResizeEdgePoint(e: PointerEvent) {
    const dpr = getPixelRatio();
    const offset = (RESIZE_HANDLE_EDGE_OFFSET_PX * dpr) / position.scale;
    const point = to_canvas_coord(e.clientX, e.clientY);
    const toPixel = ({ x, y }: { x: number; y: number }) => ({
      x: Math.round(x),
      y: Math.round(y),
    });

    switch (this.activeHandle) {
      case "LT":
        return toPixel({ x: point.x + offset, y: point.y + offset });
      case "RT":
        return toPixel({ x: point.x - offset, y: point.y + offset });
      case "RB":
        return toPixel({ x: point.x - offset, y: point.y - offset });
      case "LB":
        return toPixel({ x: point.x + offset, y: point.y - offset });
      case "INSIDE":
      case "OUTSIDE":
      case "T":
      case "B":
      case "L":
      case "R":
      case null:
        return toPixel(point);
    }
  }

  up(e: PointerEvent) {
    if (!this.isActive()) return;

    this.updateResizeFromPointer(e);
    let x = selection.x;
    let y = selection.y;

    selection.setX(0);
    selection.setY(0);
    selection.setShowHint(false);
    selection.setShowHandle(false);
    console.log("resize!!!");
    changeCanvasSize(x, y, selection.width, selection.height);

    selection.active = false;
    this.activeHandle = null;
  }
}

export const resizeTool = new ResizeTool();
