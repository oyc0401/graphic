import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";

export enum InputMode {
  DEFAULT = "BRUSH",
  Zoom = "ZOOM",
  Pinch = "PINCH",
  Pan = "PAN",
}

export enum TemporaryToolId {
  ColorPicker = "colorPicker",
  Resize = "resize",
}

export enum ToolId {
  Brush = "brush",
  Select = "select",
  Selection = "selection",
  Zoom = "zoom",
  ColorPicker = "colorPicker",
}

export enum BrushId {
  Brush = "brush",
  Eraser = "eraser",
}

export enum SessionId {
  Liquify = "liquify",
  Mosaic = "mosaic",
}

export enum MosaicToolId {
  Pixel = "pixel",
  Blur = "blur",
  Restore = "restore",
}

export enum LiquifyToolId {
  Push = "push",
  TwirlClockwise = "twirlClockwise",
  TwirlCounterClockwise = "twirlCounterClockwise",
  Bloat = "bloat",
  Pucker = "pucker",
  Restore = "restore",
}

const LIQUIFY_TWIRL_SETTINGS_ID = "liquifyTwirl";
const LIQUIFY_SCALE_SETTINGS_ID = "liquifyScale";

type LiquifyBrushSettingsId =
  | LiquifyToolId.Push
  | typeof LIQUIFY_TWIRL_SETTINGS_ID
  | typeof LIQUIFY_SCALE_SETTINGS_ID
  | LiquifyToolId.Restore;

type BrushSettingsId = BrushId | SessionId.Mosaic | LiquifyBrushSettingsId;

class PaintState {
  // 현재 활성 편집 세션. null이면 일반 편집 상태다.
  private _sessionId: SessionId | null = null;
  // pan, pinch, zoom 같은 뷰 조작 입력 오버라이드.
  private _inputMode: InputMode = InputMode.DEFAULT;
  // color picker 같은 임시 도구 오버라이드.
  private _temporaryToolId: TemporaryToolId | null = null;

  // 사용자가 선택한 앱 도구. 세션 상태는 여기에 섞지 않는다.
  private _selectedToolId: ToolId = ToolId.Brush;
  // brush/eraser 같은 브러시 계열 코어 도구.
  private _brushId: BrushId = BrushId.Brush;
  // 리퀴파이 세션 안에서 사용하는 하위 툴.
  private _liquifyToolId: LiquifyToolId = LiquifyToolId.Push;
  // 모자이크 세션 안에서 사용하는 하위 툴.
  private _mosaicToolId: MosaicToolId = MosaicToolId.Pixel;

  // 도구별 브러시 크기 설정.
  private _brushSize = {
    [BrushId.Brush]: 5,
    [BrushId.Eraser]: 10,
    [SessionId.Mosaic]: 100,
    [LiquifyToolId.Push]: 100,
    [LIQUIFY_TWIRL_SETTINGS_ID]: 100,
    [LIQUIFY_SCALE_SETTINGS_ID]: 100,
    [LiquifyToolId.Restore]: 100,
  };
  // 도구별 브러시 불투명도/강도 설정.
  private _brushAlpha = {
    [BrushId.Brush]: 100,
    [BrushId.Eraser]: 100,
    [SessionId.Mosaic]: 10,
    [LiquifyToolId.Push]: 50,
    [LIQUIFY_TWIRL_SETTINGS_ID]: 50,
    [LIQUIFY_SCALE_SETTINGS_ID]: 50,
    [LiquifyToolId.Restore]: 100,
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
  setLiquifyToolId(toolId: LiquifyToolId) {
    this._liquifyToolId = toolId;
  }
  setMosaicToolId(toolId: MosaicToolId) {
    this._mosaicToolId = toolId;
  }
  setSessionId(sessionId: SessionId | null) {
    this._sessionId = sessionId;
  }
  setTemporaryToolId(toolId: TemporaryToolId | null) {
    this._temporaryToolId = toolId;
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
    worker?.setStrokeSize(size);
  }
  setBrushAlpha(alpha: number) {
    this._brushAlpha[this.getBrushSettingsId()] = alpha;
    if (this._sessionId === SessionId.Mosaic) {
      getLayerWorker()?.setMosaicStrength(alpha);
    }
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
  getLiquifyToolId() {
    return this._liquifyToolId;
  }
  getMosaicToolId() {
    return this._mosaicToolId;
  }
  getTemporaryToolId() {
    return this._temporaryToolId;
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
    if (!this._sessionId) return this._brushId;
    if (this._sessionId === SessionId.Liquify) {
      return this.getLiquifyBrushSettingsId();
    }
    return this._sessionId;
  }

  private getLiquifyBrushSettingsId(): LiquifyBrushSettingsId {
    switch (this._liquifyToolId) {
      case LiquifyToolId.TwirlClockwise:
      case LiquifyToolId.TwirlCounterClockwise:
        return LIQUIFY_TWIRL_SETTINGS_ID;
      case LiquifyToolId.Bloat:
      case LiquifyToolId.Pucker:
        return LIQUIFY_SCALE_SETTINGS_ID;
      default:
        return this._liquifyToolId;
    }
  }
}

export const paintState = new PaintState();
