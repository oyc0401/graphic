import { makeAutoObservable, runInAction } from "mobx";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

type InputMode = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection"; // 선택창 풀면 brush로 됌
type BrushId = Extract<CoreTool, "brush" | "eraser" | "liquify">;
class PaintState {
  inputMode: InputMode = "BRUSH";
  coreTool: CoreTool = "brush";
  activeSessionTool: CoreTool | null = null;
  brushSize = { brush: 5, eraser: 10, liquify: 50 };
  brushAlpha = { brush: 100, eraser: 100, liquify: 100 };

  cursorX = 0;
  cursorY = 0;

  pointerdown = false;
  drawing = false;
  canTouch = true;

  changed = false;
  showCircle = false;
  showSizeHandle = false;

  constructor() {
    makeAutoObservable(this);
  }

  setInputMode(val: InputMode) {
    this.inputMode = val;
  }
  setCoreTool(coreTool: CoreTool) {
    this.coreTool = coreTool;
  }
  setActiveSessionTool(tool: CoreTool | null) {
    this.activeSessionTool = tool;
  }
  get toolId(): ToolId {
    switch (this.coreTool) {
      case "brush":
      case "eraser":
      case "liquify":
        return "brush";
      case "select":
      case "selection":
        return this.coreTool;
    }
  }
  get brushId(): BrushId {
    switch (this.coreTool) {
      case "eraser":
      case "liquify":
        return this.coreTool;
      case "brush":
      case "select":
      case "selection":
        return "brush";
    }
  }
  setPointerdown(val: boolean) {
    this.pointerdown = val;
  }
  setDrawing(val: boolean) {
    this.drawing = val;
  }
  setCanTouch(val: boolean) {
    if (val) {
      setTimeout(() => {
        runInAction(() => {
          this.canTouch = val;
        });
      });
    } else {
      this.canTouch = val;
    }
  }
  setCursorPosition(x, y) {
    this.cursorX = x;
    this.cursorY = y;
  }
  setBrushSize(size: number) {
    this.brushSize[this.brushId] = size;
    const worker = getLayerWorker();
    worker.setStrokeSize(size);
  }
  setBrushAlpha(alpha: number) {
    this.brushAlpha[this.brushId] = alpha;
  }
  setShowCircle(value) {
    this.showCircle = value;
  }

  setShowSizeHandle(val) {
    this.showSizeHandle = val;
  }

  getBrushSize() {
    return this.brushSize[this.brushId];
  }
  getBrushAlpha() {
    return this.brushAlpha[this.brushId];
  }
  moved = true;

  setMoved(value) {
    this.moved = value;
  }
}

export const paintState = new PaintState();
