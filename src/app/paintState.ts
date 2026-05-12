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
export type BrushId = "brush" | "eraser";
export type SessionToolId = "liquify" | "mosaic";
export type SessionReturnToolId = Extract<ToolId, "brush" | "select">;
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
  brushId: BrushId = "brush";
  sessionToolId: SessionToolId | null = null;

  sessionReturnTool: SessionReturnToolId | null = null;

  brushSize = { brush: 5, eraser: 10, liquify: 50, mosaic: 50 };
  brushAlpha = { brush: 100, eraser: 100, liquify: 100, mosaic: 100 };

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
    if (toolId === "session" && this.sessionToolId === null) {
      this.sessionToolId = "liquify";
    }
    this.selectedToolId = toolId;
    this.setInputMode(inputModeForTool(toolId));
  }
  restoreSelectedToolMode() {
    this.setInputMode(inputModeForTool(this.selectedToolId));
  }
  setCoreTool(coreTool: CoreTool) {
    switch (coreTool) {
      case "brush":
      case "eraser":
        this.brushId = coreTool;
        this.setSelectedToolId("brush");
        break;
      case "liquify":
        this.setSessionToolId(coreTool);
        break;
      case "select":
      case "selection":
        this.setSelectedToolId(coreTool);
        break;
    }
  }
  setSessionReturnTool(tool: SessionReturnToolId | null) {
    this.sessionReturnTool = tool;
  }
  setSessionToolId(tool: SessionToolId | null) {
    this.sessionToolId = tool;
    if (tool) {
      this.setSelectedToolId("session");
    } else if (this.selectedToolId === "session") {
      this.setSelectedToolId("brush");
    }
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
  get coreTool(): CoreTool {
    switch (this.selectedToolId) {
      case "brush":
        return this.brushId;
      case "session":
        return this.sessionToolId === "liquify" ? "liquify" : "brush";
      case "select":
      case "selection":
        return this.selectedToolId;
      case "zoom":
      case "colorPicker":
        return this.brushId;
    }
  }
  get brushSettingsId(): BrushSettingsId {
    return this.selectedToolId === "session"
      ? (this.sessionToolId ?? this.brushId)
      : this.brushId;
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
