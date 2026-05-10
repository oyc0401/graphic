import { makeAutoObservable, runInAction } from "mobx";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

type InputMode = "BRUSH" | "ZOOM" | "PINCH" | "PAN";
type ToolId = "brush" | "select" | "selection" | "zoom" | "eyedropper";
type BrushId = Extract<CoreTool, "brush" | "eraser" | "liquify">;
class PaintState {
  inputMode: InputMode = "BRUSH";
  selectedToolId: ToolId = "brush";
  coreTool: CoreTool = "brush";
  activeSessionTool: CoreTool | null = null;
  sessionReturnTool: CoreTool | null = null;
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
  setSelectedToolId(toolId: ToolId) {
    this.selectedToolId = toolId;
    this.inputMode = toolId === "zoom" ? "ZOOM" : "BRUSH";
  }
  restoreSelectedToolMode() {
    this.inputMode = this.selectedToolId === "zoom" ? "ZOOM" : "BRUSH";
  }
  setCoreTool(coreTool: CoreTool) {
    this.coreTool = coreTool;
  }
  setActiveSessionTool(tool: CoreTool | null) {
    this.activeSessionTool = tool;
  }
  setSessionReturnTool(tool: CoreTool | null) {
    this.sessionReturnTool = tool;
  }
  get toolId(): ToolId {
    return this.selectedToolId;
  }
  get activeToolId(): ToolId {
    if (this.inputMode === "ZOOM") {
      return "zoom";
    }

    return this.selectedToolId;
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
