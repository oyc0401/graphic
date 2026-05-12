import { makeAutoObservable, runInAction } from "mobx";
import { getLayerWorker } from "./worker/workerPool";

export enum InputMode {
  Brush = "BRUSH",
  Zoom = "ZOOM",
  Pinch = "PINCH",
  Pan = "PAN",
  ColorPicker = "COLOR_PICKER",
}

export enum ToolId {
  Brush = "brush",
  Select = "select",
  Selection = "selection",
  Zoom = "zoom",
  ColorPicker = "colorPicker",
  Session = "session",
}

export enum BrushId {
  Brush = "brush",
  Eraser = "eraser",
}

export enum SessionToolId {
  Liquify = "liquify",
  Mosaic = "mosaic",
}

export type SessionReturnToolId = ToolId.Brush | ToolId.Select;
type BrushSettingsId = BrushId | SessionToolId;

function inputModeForTool(toolId: ToolId): InputMode {
  switch (toolId) {
    case ToolId.Zoom:
      return InputMode.Zoom;
    case ToolId.ColorPicker:
      return InputMode.ColorPicker;
    case ToolId.Brush:
    case ToolId.Select:
    case ToolId.Selection:
    case ToolId.Session:
      return InputMode.Brush;
  }
}

class PaintState {
  inputMode: InputMode = InputMode.Brush;
  selectedToolId: ToolId = ToolId.Brush;
  brushId: BrushId = BrushId.Brush;
  sessionToolId: SessionToolId | null = null;

  sessionReturnTool: SessionReturnToolId | null = null;

  brushSize = {
    [BrushId.Brush]: 5,
    [BrushId.Eraser]: 10,
    [SessionToolId.Liquify]: 50,
    [SessionToolId.Mosaic]: 50,
  };
  brushAlpha = {
    [BrushId.Brush]: 100,
    [BrushId.Eraser]: 100,
    [SessionToolId.Liquify]: 100,
    [SessionToolId.Mosaic]: 100,
  };

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
    if (toolId === ToolId.Session && this.sessionToolId === null) {
      this.sessionToolId = SessionToolId.Liquify;
    }
    this.selectedToolId = toolId;
    this.setInputMode(inputModeForTool(toolId));
  }
  restoreSelectedToolMode() {
    this.setInputMode(inputModeForTool(this.selectedToolId));
  }
  setBrushId(brushId: BrushId) {
    this.brushId = brushId;
  }
  setSessionReturnTool(tool: SessionReturnToolId | null) {
    this.sessionReturnTool = tool;
  }
  setSessionToolId(tool: SessionToolId | null) {
    this.sessionToolId = tool;
    if (tool) {
      this.setSelectedToolId(ToolId.Session);
    } else if (this.selectedToolId === ToolId.Session) {
      this.setSelectedToolId(ToolId.Brush);
    }
  }
  get toolId(): ToolId {
    return this.selectedToolId;
  }
  get activeToolId(): ToolId {
    if (this.inputMode === InputMode.Zoom) {
      return ToolId.Zoom;
    }
    if (this.inputMode === InputMode.ColorPicker) {
      return ToolId.ColorPicker;
    }

    return this.selectedToolId;
  }
  get brushSettingsId(): BrushSettingsId {
    return this.selectedToolId === ToolId.Session
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
