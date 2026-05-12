import { makeAutoObservable, runInAction } from "mobx";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

type InputMode = "BRUSH" | "ZOOM" | "PINCH" | "PAN" | "COLOR_PICKER";
export type ToolId =
  | "brush"
  | "select"
  | "selection"
  | "zoom"
  | "colorPicker"
  | "session";
export type BrushId = Extract<CoreTool, "brush" | "eraser">;
export type SessionToolId = Extract<CoreTool, "liquify">;
type BrushSettingsId = BrushId | SessionToolId;

function inputModeForTool(toolId: ToolId): InputMode {
  switch (toolId) {
    case "zoom":
      return "ZOOM";
    case "colorPicker":
      return "COLOR_PICKER";
    case "brush":
    case "select":
    case "selection":
    case "session":
      return "BRUSH";
  }
}

class PaintState {
  inputMode: InputMode = "BRUSH";
  selectedToolId: ToolId = "brush";
  coreTool: CoreTool = "brush";
  sessionToolId: SessionToolId = "liquify";

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
    this.setInputMode(inputModeForTool(toolId));
  }
  restoreSelectedToolMode() {
    this.setInputMode(inputModeForTool(this.selectedToolId));
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
    if (this.inputMode === "COLOR_PICKER") {
      return "colorPicker";
    }

    return this.selectedToolId;
  }
  get brushId(): BrushId {
    switch (this.coreTool) {
      case "eraser":
        return this.coreTool;
      case "brush":
      case "liquify":
      case "select":
      case "selection":
        return "brush";
    }
  }
  get brushSettingsId(): BrushSettingsId {
    return this.selectedToolId === "session" ? this.sessionToolId : this.brushId;
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
    this.brushSize[this.brushSettingsId] = size;
    const worker = getLayerWorker();
    worker.setStrokeSize(size);
  }
  setBrushAlpha(alpha: number) {
    this.brushAlpha[this.brushSettingsId] = alpha;
  }
  setShowCircle(value) {
    this.showCircle = value;
  }

  setShowSizeHandle(val) {
    this.showSizeHandle = val;
  }

  getBrushSize() {
    return this.brushSize[this.brushSettingsId];
  }
  getBrushAlpha() {
    return this.brushAlpha[this.brushSettingsId];
  }
  moved = true;

  setMoved(value) {
    this.moved = value;
  }
}

export const paintState = new PaintState();
