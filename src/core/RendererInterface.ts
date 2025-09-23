import type { Pointer } from "./types.js";

interface HistoryResponse {
  tool: string;
  undoCount: number;
  redoCount: number;
}

export interface RendererInterface {
  // === 입력(브러시) ===
  start(pointer: Pointer): void;
  strokeTo(pointer: Pointer): void;
  end(): void;
  cancel(): void;

  // === 스타일 ===
  setStrokeColor(r: number, g: number, b: number): void;
  setStrokeSize(size: number): void;
  setAlpha(alpha: number): void;

  // === 레이어 ===
  setLayerId(layerId: string | number): void;
  resizeLayer(px: number, py: number, width: number, height: number): void;

  // === 카메라 및 뷰포트 ===
  setCameraPosition(px: number, py: number, magnification: number): void;
  resizeScreenSize(screenWidth: number, screenHeight: number): void;
  render(): void;

  // === 도구 관리 ===
  setTool(toolId: string | number, doExit?: boolean): void;

  // === 선택 영역 ===
  select(px: number, py: number, w: number, h: number): void;
  endMove(): void;
  moveSelection(px: number, py: number, width: number, height: number, flipH?: boolean, flipV?: boolean): void;
  applySelection(): void;

  // === 클립보드 ===
  paste(
    px: number,
    py: number,
    width: number,
    height: number,
    imageBitmap: ImageBitmap
  ): void;
  getSelectionPixel(): {
    pixels: Uint8ClampedArray<ArrayBufferLike>;
    width: number;
    height: number;
  };
  cut(): {
    pixels: Uint8ClampedArray<ArrayBufferLike>;
    width: number;
    height: number;
  };
  selectionDelete(): void;

  // === 이미지 관리 ===
  uploadImage(bitmap: ImageBitmap): HistoryResponse;
  resetImage(width: number, height: number): HistoryResponse;
  downloadImage(): void;

  // === 실행 취소/재실행 ===
  undo(): Promise<HistoryResponse>;
  redo(): Promise<HistoryResponse>;

  // 서비스 정보
  getServiceType(): "canvas2d" | "webgl" | "webgpu";
  isInitialized(): boolean;

  // 리소스 정리
  destroy(): void;
}
