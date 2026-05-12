import { InputMode, paintState } from "../paintState";
import {
  resizeSelectionFromHandle,
  type SelectionResizeHandle,
} from "../utils/selectionResize";
import { changeCanvasSize } from "../position";

import { clamp } from "../utils/math";
import { paintConfig } from "@/paint.config";
import { canvasResizeState, type CanvasResizeRect } from "../canvasResizeState";
import { getToolMetadata } from "./toolRegistry";
import {
  cursorForResizeHandle,
  getCanvasResizeRect,
  hitTestOutsideCanvasResizeCorner,
  toResizeEdgePoint,
  type ResizeCornerHandle,
} from "../utils/resizeGeometry";

export class ResizeTool {
  private start: CanvasResizeRect = { x: 0, y: 0, width: 1, height: 1 };

  isVisible() {
    return (
      canvasResizeState.active ||
      (!paintState.pointerdown && this.canUseCanvasResizeHandle())
    );
  }

  isActive() {
    return canvasResizeState.active;
  }

  canStart(e: PointerEvent) {
    if (!this.canUseCanvasResizeHandle()) return false;
    return this.hitTest(e) !== null;
  }

  down(e: PointerEvent) {
    if (!this.canStart(e)) return;

    const handle = this.hitTest(e);
    if (!handle) return;

    const rect = getCanvasResizeRect();
    this.start = rect;
    canvasResizeState.start(handle, rect, e);
  }

  move(e: PointerEvent) {
    const hoveredHandle = this.isVisible() ? this.hitTest(e) : null;
    canvasResizeState.setHover(cursorForResizeHandle(hoveredHandle));

    if (!paintState.pointerdown || !this.isActive()) return;

    canvasResizeState.setPointer(e);
    this.updateResize(e);
  }

  up(e: PointerEvent) {
    if (!this.isActive()) return;

    canvasResizeState.setPointer(e);
    this.updateResize(e);

    const { x, y, width, height } = canvasResizeState.rect;
    canvasResizeState.reset();
    changeCanvasSize(x, y, width, height);
  }

  cancel(e: PointerEvent) {
    this.up(e);
  }

  private canUseCanvasResizeHandle() {
    const toolMetadata = getToolMetadata(paintState.activeToolId);
    const brushIdBlocksCanvasResizeHandle =
      toolMetadata.blockCanvasResizeHandleBrushIds?.includes(
        paintState.brushId,
      );

    return (
      paintState.inputMode === InputMode.Brush &&
      toolMetadata.allowCanvasResizeHandle &&
      !brushIdBlocksCanvasResizeHandle
    );
  }

  private hitTest(e: PointerEvent): ResizeCornerHandle | null {
    return hitTestOutsideCanvasResizeCorner(e.clientX, e.clientY);
  }

  private updateResize(e: PointerEvent) {
    const handle = canvasResizeState.activeHandle;
    if (!handle) return;

    const point = toResizeEdgePoint(e, handle);
    const min = 1;
    const max = paintConfig.maxSize;
    const resized = resizeSelectionFromHandle({
      startRect: this.start,
      handle: handle as SelectionResizeHandle,
      pointer: point,
      keepRatio: e.shiftKey,
      allowFlip: false,
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
