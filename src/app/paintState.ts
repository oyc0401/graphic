import { makeAutoObservable } from "mobx";
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
  // 픽셀 유동화 같은 편집 세션이 켜져 있는지.
  private _sessionMode = false;
  // 현재 사용할 세션 종류. 세션 중일 때 실제 활성 세션이 된다.
  private _sessionId: SessionId = SessionId.Liquify;
  // pan, pinch, 임시 zoom/color pick 같은 입력 오버라이드.
  private _inputMode: InputMode = InputMode.DEFAULT;
  // 사용자가 선택한 앱 도구. 세션 상태는 여기에 섞지 않는다.
  private _selectedToolId: ToolId = ToolId.Brush;
  // brush/eraser 같은 브러시 계열 코어 도구.
  private _brushId: BrushId = BrushId.Brush;

  // 도구별 브러시 크기 설정.
  private _brushSize = {
    [BrushId.Brush]: 5,
    [BrushId.Eraser]: 10,
    [SessionId.Liquify]: 50,
    [SessionId.Mosaic]: 50,
  };
  // 도구별 브러시 불투명도/강도 설정.
  private _brushAlpha = {
    [BrushId.Brush]: 100,
    [BrushId.Eraser]: 100,
    [SessionId.Liquify]: 100,
    [SessionId.Mosaic]: 100,
  };

  // 앱이 pointer press를 추적 중인지.
  private _pointerdown = false;

  // 커서와 좌표 UI에 쓰는 마지막 포인터 위치.
  private _cursorX = 0;
  private _cursorY = 0;
  // 브러시 stroke 중 브러시 커서를 보여줄지.
  private _showBrushCursor = false;

  // Alt를 누르는 동안 브러시 커서 프리뷰를 보여줄지.
  private _showBrushCursorPreview = false;

  // 현재 브러시 stroke가 이동했는지.
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
  setSessionMode(value: boolean) {
    this._sessionMode = value;
  }
  setSessionId(sessionId: SessionId) {
    this._sessionId = sessionId;
  }
  setPointerdown(val: boolean) {
    this._pointerdown = val;
  }
  setShowBrushCursor(val: boolean) {
    this._showBrushCursor = val;
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
  setShowBrushCursorPreview(value) {
    this._showBrushCursorPreview = value;
  }

  setMoved(value) {
    this._moved = value;
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
  getShowBrushCursor() {
    return this._showBrushCursor;
  }
  getShowBrushCursorPreview() {
    return this._showBrushCursorPreview;
  }
  getMoved() {
    return this._moved;
  }
  getToolId(): ToolId {
    return this._selectedToolId;
  }

  /** .etc */

  private getBrushSettingsId(): BrushSettingsId {
    return this._sessionMode ? this._sessionId : this._brushId;
  }
}

export const paintState = new PaintState();
