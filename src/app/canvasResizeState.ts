import { makeAutoObservable } from "mobx";
import type { ResizeCornerHandle, ResizeCursor } from "./utils/resizeGeometry";

export type CanvasResizeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

class CanvasResizeState {
  active = false;
  hover: ResizeCursor | null = null;
  activeHandle: ResizeCornerHandle | null = null;
  rect: CanvasResizeRect = { x: 0, y: 0, width: 1, height: 1 };
  pointer = { clientX: 0, clientY: 0 };

  constructor() {
    makeAutoObservable(this);
  }

  start(handle: ResizeCornerHandle, rect: CanvasResizeRect, pointer: PointerEvent) {
    this.active = true;
    this.activeHandle = handle;
    this.rect = rect;
    this.pointer = { clientX: pointer.clientX, clientY: pointer.clientY };
  }

  setRect(rect: CanvasResizeRect) {
    this.rect = rect;
  }

  setPointer(pointer: PointerEvent) {
    this.pointer = { clientX: pointer.clientX, clientY: pointer.clientY };
  }

  setHover(hover: ResizeCursor | null) {
    this.hover = hover;
  }

  reset() {
    this.active = false;
    this.activeHandle = null;
    this.hover = null;
  }
}

export const canvasResizeState = new CanvasResizeState();
