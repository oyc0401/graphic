import { InputMode, paintState, TemporaryToolId } from "../paintState";
import { changeCanvasSize } from "../position";

import { clamp } from "../utils/math";
import { paintConfig } from "@/paint.config";
import { canvasResizeState, type CanvasResizeRect } from "../canvasResizeState";
import { resizeCanvasFromHandleDrag } from "../utils/canvasResize";
import {
  cursorForResizeHandle,
  getCanvasResizeRect,
  hitTestOutsideCanvasResizeCorner,
  toResizeEdgePoint,
  type ResizeCornerHandle,
} from "../utils/resizeGeometry";
import type { Tool, ToolConfig } from "./Tool";

export class ResizeTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private start: CanvasResizeRect = { x: 0, y: 0, width: 1, height: 1 };
  private startPointer = { x: 0, y: 0 };

  enter() {}

  exit() {
    canvasResizeState.reset();
  }

  canUse() {
    return (
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getTemporaryToolId() === TemporaryToolId.Resize
    );
  }

  isActive() {
    return canvasResizeState.active;
  }

  canStart(e: PointerEvent) {
    return this.hitTest(e) !== null;
  }

  down(e: PointerEvent) {
    if (!this.canUse()) return;

    const handle = this.hitTest(e);
    if (!handle) return;

    const rect = getCanvasResizeRect();
    this.start = rect;
    this.startPointer = toResizeEdgePoint(e, handle);
    canvasResizeState.start(handle, rect, e);
    this.updateResize(e);
  }

  move(e: PointerEvent) {
    if (!this.canUse() || !paintState.getPointerdown() || !this.isActive()) {
      return;
    }

    canvasResizeState.setPointer(e);
    this.updateResize(e);
  }

  up(e: PointerEvent) {
    if (!this.canUse()) return;

    if (this.isActive()) {
      canvasResizeState.setPointer(e);
      this.updateResize(e);

      const { x, y, width, height } = canvasResizeState.rect;
      canvasResizeState.reset();
      changeCanvasSize(x, y, width, height);
    }

    paintState.setTemporaryToolId(null);
  }

  cancel() {
    canvasResizeState.reset();
    paintState.setTemporaryToolId(null);
  }

  private hitTest(e: PointerEvent): ResizeCornerHandle | null {
    return hitTestOutsideCanvasResizeCorner(e.clientX, e.clientY);
  }

  updateHover(e: PointerEvent, enabled: boolean) {
    if (this.isActive()) {
      canvasResizeState.setHover(
        cursorForResizeHandle(canvasResizeState.activeHandle),
      );
      return;
    }

    const hoveredHandle = enabled ? this.hitTest(e) : null;
    canvasResizeState.setHover(cursorForResizeHandle(hoveredHandle));
  }

  private updateResize(e: PointerEvent) {
    const handle = canvasResizeState.activeHandle;
    if (!handle) return;

    const point = toResizeEdgePoint(e, handle);
    const min = 1;
    const max = paintConfig.maxSize;
    const resized = resizeCanvasFromHandleDrag({
      startRect: this.start,
      handle,
      startPointer: this.startPointer,
      pointer: point,
    });
    const width = clamp(resized.width, min, max);
    const height = clamp(resized.height, min, max);
    const x = handle.includes("L")
      ? this.start.x + this.start.width - width
      : resized.x;
    const y = handle.includes("T")
      ? this.start.y + this.start.height - height
      : resized.y;

    canvasResizeState.setRect({ x, y, width, height });
  }
}

export const resizeTool = new ResizeTool();
