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
  private _sessionMode = false;
  private _sessionId: SessionId = SessionId.Liquify;
  private _inputMode: InputMode = InputMode.DEFAULT;
  private _selectedToolId: ToolId = ToolId.Brush;
  private _brushId: BrushId = BrushId.Brush;

  private _brushSize = {
    [BrushId.Brush]: 5,
    [BrushId.Eraser]: 10,
    [SessionId.Liquify]: 50,
    [SessionId.Mosaic]: 50,
  };
  private _brushAlpha = {
    [BrushId.Brush]: 100,
    [BrushId.Eraser]: 100,
    [SessionId.Liquify]: 100,
    [SessionId.Mosaic]: 100,
  };

  private _cursorX = 0;
  private _cursorY = 0;

  private _pointerdown = false;
  private _drawing = false;
  private _canTouch = true;

  private _changed = false;
  private _showCircle = false;
  private _showSizeHandle = false;

  private _moved = true;

  constructor() {
    makeAutoObservable(this);
  }

  /** Setter */
  setInputMode(val: InputMode) {
    this._inputMode = val;
  }
  setSelectedToolId(toolId: ToolId) {
    this._selectedToolId = toolId;
  }
  setBrushId(brushId: BrushId) {
    this._brushId = brushId;
  }
  setSessionId(sessionId: SessionId) {
    this._sessionId = sessionId;
  }
  setPointerdown(val: boolean) {
    this._pointerdown = val;
  }
  setDrawing(val: boolean) {
    this._drawing = val;
  }
  setCanTouch(val: boolean) {
    if (val) {
      setTimeout(() => {
        runInAction(() => {
          this._canTouch = val;
        });
      });
    } else {
      this._canTouch = val;
    }
  }
  setCursorPosition(x, y) {
    this._cursorX = x;
    this._cursorY = y;
  }
  setBrushSize(size: number) {
    this._brushSize[this.getBrushSettingsId()] = size;
    const worker = getLayerWorker();
    worker.setStrokeSize(size);
  }
  setBrushAlpha(alpha: number) {
    this._brushAlpha[this.getBrushSettingsId()] = alpha;
  }
  setShowCircle(value) {
    this._showCircle = value;
  }

  setShowSizeHandle(val) {
    this._showSizeHandle = val;
  }

  setMoved(value) {
    this._moved = value;
  }

  setChanged(value: boolean) {
    this._changed = value;
  }

  /** Getter functions */

  getBrushSize() {
    return this._brushSize[this.getBrushSettingsId()];
  }
  getBrushAlpha() {
    return this._brushAlpha[this.getBrushSettingsId()];
  }
  getSessionMode() {
    return this._sessionMode;
  }
  getSessionId() {
    return this._sessionId;
  }
  getInputMode() {
    return this._inputMode;
  }
  getSelectedToolId() {
    return this._selectedToolId;
  }
  getBrushId() {
    return this._brushId;
  }
  getCursorX() {
    return this._cursorX;
  }
  getCursorY() {
    return this._cursorY;
  }
  getPointerdown() {
    return this._pointerdown;
  }
  getDrawing() {
    return this._drawing;
  }
  getCanTouch() {
    return this._canTouch;
  }
  getChanged() {
    return this._changed;
  }
  getShowCircle() {
    return this._showCircle;
  }
  getShowSizeHandle() {
    return this._showSizeHandle;
  }
  getMoved() {
    return this._moved;
  }
  getToolId(): ToolId {
    return this._selectedToolId;
  }
  getActiveToolId(): ToolId {
    if (this._inputMode === InputMode.Zoom) {
      return ToolId.Zoom;
    }
    if (this._inputMode === InputMode.ColorPicker) {
      return ToolId.ColorPicker;
    }
    if (this._sessionMode) {
      return ToolId.Session;
    }

    return this._selectedToolId;
  }

  private getBrushSettingsId(): BrushSettingsId {
    return this._sessionMode ? this._sessionId : this._brushId;
  }

  /** .etc */

  startSession(sessionId: SessionId) {
    this._sessionId = sessionId;
    this._sessionMode = true;
  }
  endSession() {
    this._sessionMode = false;
  }
}

export const paintState = new PaintState();
