import type { Pointer } from "./types.js";

export interface IRenderService {
  // 스트로크 라이프사이클
  start(pointer: Pointer): void;
  strokeTo(pointer: Pointer): void;
  end(): void;
  cancel(): void;

  // 서비스 정보
  getServiceType(): "canvas2d" | "webgl" | "webgpu";
  isInitialized(): boolean;

  // 리소스 정리
  destroy(): void;
}
