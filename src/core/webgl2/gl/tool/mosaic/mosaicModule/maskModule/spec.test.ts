import { describe, it } from "vitest";
import { mosaicMaskModule } from "./index";

describe("mosaicMaskModule", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;

      const width = canvas.width;
      const height = canvas.height;

      // sourceMaskTexture: 스트로크 시작 시점의 mask 스냅샷 (read-only 기준)
      // maskTexture: 스트로크 중 실제로 수정되는 mask
      const sourceMaskTexture = gl.createTexture()!; // 사실 읽지도 않을거같은데 일단 리퀴파이랑 통일성 맞추려고 넣음...
      const maskTexture = gl.createTexture()!;

      type Rect = { x: number; y: number; width: number; height: number };

      interface MosaicMaskInterface {
        setRadius(radius: number): void;
        start(point: { x: number; y: number }): Rect;
        move(point: { x: number; y: number }): Rect;
        end(): Rect;
        restoreStart(point: { x: number; y: number }): Rect;
        restoreMove(point: { x: number; y: number }): Rect;
      }

      const mask: MosaicMaskInterface = mosaicMaskModule(gl, {
        sourceMaskTexture,
        maskTexture,
        width,
        height,
      });

      mask.setRadius(50);

      // 페인트 스트로크: start -> move... -> end
      // 각 단계마다 dirty rect를 반환 → 외부에서 해당 영역만 다시 렌더링
      // 이걸하면 maskTexture이 수정됌.
      const previewRect1 = mask.start({ x: 100, y: 100 });
      const previewRect2 = mask.move({ x: 130, y: 110 });
      const strokeRect = mask.end(); // 이 스트로크 전체의 bounding rect 반환
      // strokeRect를 기반으로 외부에서 소스텍스쳐에 결과를 커밋하고 히스토리를 만든다.

      // cancel: mask를 sourceMaskTexture 상태로 되돌림
      const previewRect3 = mask.start({ x: 200, y: 200 });
      const previewRect4 = mask.move({ x: 230, y: 210 });

      // 외부에서 cancel하면 그냥 안쓰면 됌
      const strokeRect2 = mask.end();

      // restore: mask를 지워서 원본으로 복원
      const restoreRect1 = mask.restoreStart({ x: 100, y: 200 });
      const restoreRect2 = mask.restoreMove({ x: 130, y: 210 });
      const restoreStrokeRect = mask.end();
    };
  });
});
