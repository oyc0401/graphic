import type { ResizeCornerHandle } from "./resizeGeometry";

export type CanvasResizeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasResizePoint = {
  x: number;
  y: number;
};

export type CanvasResizeDragInput = {
  startRect: CanvasResizeRect;
  handle: ResizeCornerHandle;
  startPointer: CanvasResizePoint;
  pointer: CanvasResizePoint;
};

export function resizeCanvasFromHandleDrag({
  startRect,
  handle,
  startPointer,
  pointer,
}: CanvasResizeDragInput): CanvasResizeRect {
  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;

  let x = startRect.x;
  let y = startRect.y;
  let width = startRect.width;
  let height = startRect.height;

  if (handle.includes("L")) {
    x += dx;
    width -= dx;
  }

  if (handle.includes("R")) {
    width += dx;
  }

  if (handle.includes("T")) {
    y += dy;
    height -= dy;
  }

  if (handle.includes("B")) {
    height += dy;
  }

  return { x, y, width, height };
}
