import { describe, it } from "vitest";
import { DisplacementModule } from "./index";

describe("displacementModule", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;

      const width = canvas.width;
      const height = canvas.height;

      // sourceDisplacementTexture: 스트로크 시작 시점의 displacement 스냅샷 (read-only 기준)
      // displacementTexture: 스트로크 중 실제로 수정되는 displacement
      const sourceDisplacementTexture = gl.createTexture()!; // read-only
      const displacementTexture = gl.createTexture()!;

      type Rect = { x: number; y: number; width: number; height: number };

      interface DisplacementInterface {
        setRadius(radius: number): void;
        setStrength(strength: number): void;
        start(point: { x: number; y: number }): Rect | null;
        move(point: { x: number; y: number }): Rect | null;
        end(): Rect | null;
        spin(point: { x: number; y: number }): Rect | null;
        rightSpin(point: { x: number; y: number }): Rect | null;
        bloat(point: { x: number; y: number }): Rect | null;
        pucker(point: { x: number; y: number }): Rect | null;
        restoreStart(point: { x: number; y: number }): Rect | null;
        restoreMove(point: { x: number; y: number }): Rect | null;
      }

      const displacement: DisplacementInterface = DisplacementModule(gl, {
        sourceDisplacementTexture,
        displacementTexture,
        width,
        height,
      });

      displacement.setRadius(50);
      displacement.setStrength(0.5);

      // push 스트로크: start -> move... -> end
      // 각 단계마다 dirty rect를 반환 → 외부에서 해당 영역만 다시 렌더링
      // 이걸하면 displacementTexture이 수정됌.
      const previewRect1 = displacement.start({ x: 100, y: 100 });
      const previewRect2 = displacement.move({ x: 130, y: 110 });
      const strokeRect = displacement.end(); // 이 스트로크 전체의 bounding rect 반환
      // strokeRect를 기반으로 외부에서 소스텍스쳐에 결과를 커밋하고 히스토리를 만든다.

      // cancel: displacement를 sourceDisplacementTexture 상태로 되돌림
      const previewRect3 = displacement.start({ x: 200, y: 200 });
      const previewRect4 = displacement.move({ x: 230, y: 210 });

      // 외부에서 cancel하면 그냥 안쓰면 됌
      const strokeRect2 = displacement.end();

      // spin (시계 반대 방향 트윌)
      const spinRect = displacement.spin({ x: 300, y: 300 });
      displacement.end();

      // rightSpin (시계 방향 트윌)
      const rightSpinRect = displacement.rightSpin({ x: 350, y: 300 });
      displacement.end();

      // bloat (팽창)
      const bloatRect = displacement.bloat({ x: 400, y: 300 });
      displacement.end();

      // pucker (수축)
      const puckerRect = displacement.pucker({ x: 450, y: 300 });
      displacement.end();

      // restore: displacement를 지워서 원본으로 복원
      const restoreRect1 = displacement.restoreStart({ x: 100, y: 200 });
      const restoreRect2 = displacement.restoreMove({ x: 130, y: 210 });
      const restoreStrokeRect = displacement.end();
    };
  });
});
