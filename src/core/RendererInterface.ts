import type {
  CoreSessionTool,
  CoreTool,
  MosaicMode,
  Pointer,
  ShapeKind,
} from "./types.js";
import type { HistoryResponse } from "./history/history";

// 이거 안쓰는 코드임
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
  sampleColor(px: number, py: number): { r: number; g: number; b: number };

  // === 레이어 ===
  setLayerId(layerId: string | number): void;
  resizeLayer(px: number, py: number, width: number, height: number): void;

  // === 카메라 및 뷰포트 ===
  setCameraPosition(px: number, py: number, magnification: number): void;
  resizeScreenSize(screenWidth: number, screenHeight: number): void;
  render(): void;

  // === 도구 관리 ===
  setTool(toolId: CoreTool): void;
  openSession(toolId: CoreSessionTool): void;
  setMosaicTool(toolId: MosaicMode): void;
  setMosaicStrength(strength: number): void;
  commitSession(): void;
  discardSession(): void;
  getHistoryCount(): { undoCount: number; redoCount: number };

  // === 도형 ===
  startShape(kind: ShapeKind): void;
  setRectShape(px: number, py: number, width: number, height: number): void;
  transformShape(px: number, py: number, width: number, height: number): void;
  completeTransformShape(): void;
  setLineShape(p1: Pointer, p2: Pointer, c1?: Pointer, c2?: Pointer): void;
  applyShape(): void;
  discardShape(): void;

  // === 선택 영역 ===
  createSelection(px: number, py: number, w: number, h: number): void;
  createFreeformSelection(points: Pointer[]): void;
  transformSelection(
    px: number,
    py: number,
    width: number,
    height: number,
    flipH?: boolean,
    flipV?: boolean,
  ): void;
  completeTransformSelection(): void;
  commitSelection(): void;

  // === 클립보드 ===
  paste(
    px: number,
    py: number,
    width: number,
    height: number,
    imageBitmap: ImageBitmap,
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
  deleteSelection(): void;

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
