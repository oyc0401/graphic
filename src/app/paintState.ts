import { makeAutoObservable, runInAction } from "mobx";
import { getLayerWorker } from "./worker/workerPool";

export enum InputMode {
  DEFAULT = "BRUSH",
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

export enum SessionId {
  Liquify = "liquify",
  Mosaic = "mosaic",
}

type BrushSettingsId = BrushId | SessionId;

class PaintState {
  sessionMode = false;
  sessionId: SessionId = SessionId.Liquify; // liquify, mosaic
  inputMode: InputMode = InputMode.DEFAULT; // DEFAULT, ZOOM, COLOR_PICKER
  selectedToolId: ToolId = ToolId.Brush; // brush, select, selection, zoom, colorPicker
  brushId: BrushId = BrushId.Brush; // Brush, Eraser

  brushSize = {
    [BrushId.Brush]: 5,
    [BrushId.Eraser]: 10,
    [SessionId.Liquify]: 50,
    [SessionId.Mosaic]: 50,
  };
  brushAlpha = {
    [BrushId.Brush]: 100,
    [BrushId.Eraser]: 100,
    [SessionId.Liquify]: 100,
    [SessionId.Mosaic]: 100,
  };

  cursorX = 0;
  cursorY = 0;

  pointerdown = false;
  drawing = false;
  canTouch = true;

  changed = false;
  showCircle = false;
  showSizeHandle = false;

  moved = true;

  constructor() {
    makeAutoObservable(this);
  }

  /** Setter */
  setInputMode(val: InputMode) {
    this.inputMode = val;
  }
  setSelectedToolId(toolId: ToolId) {
    this.selectedToolId = toolId;
  }
  setBrushId(brushId: BrushId) {
    this.brushId = brushId;
  }
  setSessionId(sessionId: SessionId) {
    this.sessionId = sessionId;
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

  setMoved(value) {
    this.moved = value;
  }

  /** Getter */

  getBrushSize() {
    return this.brushSize[this.brushSettingsId];
  }
  getBrushAlpha() {
    return this.brushAlpha[this.brushSettingsId];
  }

  /** .etc */

  startSession(sessionId: SessionId) {
    this.sessionId = sessionId;
    this.sessionMode = true;
  }
  endSession() {
    this.sessionMode = false;
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
    if (this.sessionMode) {
      return ToolId.Session;
    }

    return this.selectedToolId;
  }
  get brushSettingsId(): BrushSettingsId {
    return this.sessionMode ? this.sessionId : this.brushId;
  }
}

export const paintState = new PaintState();
