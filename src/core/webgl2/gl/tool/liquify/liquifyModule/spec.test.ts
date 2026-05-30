import { describe, it } from "vitest";
import { DisplacementModule } from "./displacementModule";
import { LiquifyRenderModule } from "./renderModule";

describe("liquifyModule 사용법", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;

      const width = canvas.width;
      const height = canvas.height;

      // 원본이미지가 담긴 텍스쳐
      const imageTexture = gl.createTexture()!;

      // 결과 텍스쳐. 화면에 그대로 보여진다.
      const resultTexture = gl.createTexture()!;

      // sourceDisplacementTexture: 스트로크 시작 시점의 displacement 스냅샷 (read-only 기준)
      // displacementTexture: 스트로크 중 실제로 수정되는 displacement
      // 두 모듈이 이 텍스쳐들을 공유한다.
      const sourceDisplacementTexture = gl.createTexture()!;
      const displacementTexture = gl.createTexture()!;

      const displacement = DisplacementModule(gl, {
        sourceDisplacementTexture,
        displacementTexture,
        width,
        height,
      });

      const render = LiquifyRenderModule(gl, {
        imageTexture,
        resultTexture,
        displacementTexture,
        width,
        height,
      });

      displacement.setRadius(50);
      displacement.setStrength(0.5);

      // push 스트로크: start -> move... -> end
      // displacement가 dirty rect를 반환 → 해당 영역만 render한다.
      const previewRect1 = displacement.start({ x: 100, y: 100 });
      render.render(previewRect1); // 변위맵을 보고 특정부분을 렌더링

      const previewRect2 = displacement.move({ x: 130, y: 110 });
      render.render(previewRect2);

      const strokeRect = displacement.end(); // 이 스트로크 전체의 bounding rect 반환
      // 외부에서 strokeRect 범위의 displacementTexture를 sourceDisplacementTexture에 커밋하고 히스토리를 만든다.

      // cancel일 때
      const previewRect3 = displacement.start({ x: 200, y: 200 });
      render.render(previewRect3);
      const previewRect4 = displacement.move({ x: 230, y: 210 });
      render.render(previewRect4);

      const strokeRect2 = displacement.end();
      // strokeRect2 범위의 displacementTexture에 sourceDisplacementTexture로 덮어쓰고 render한다. 히스토리는 만들지 않음.
      render.render(strokeRect2);

      // spin (시계 반대 방향 트윌)
      const spinRect = displacement.spin({ x: 300, y: 300 });
      render.render(spinRect);
      const spinStrokeRect = displacement.end();
      render.render(spinStrokeRect);

      // rightSpin (시계 방향 트윌)
      const rightSpinRect = displacement.rightSpin({ x: 350, y: 300 });
      render.render(rightSpinRect);
      render.render(displacement.end());

      // bloat (팽창)
      const bloatRect = displacement.bloat({ x: 400, y: 300 });
      render.render(bloatRect);
      render.render(displacement.end());

      // pucker (수축)
      const puckerRect = displacement.pucker({ x: 450, y: 300 });
      render.render(puckerRect);
      render.render(displacement.end());

      // restore: displacement를 지워서 원본으로 복원
      const restoreRect1 = displacement.restoreStart({ x: 100, y: 200 });
      render.render(restoreRect1);
      const restoreRect2 = displacement.restoreMove({ x: 130, y: 210 });
      render.render(restoreRect2);
      const restoreStrokeRect = displacement.end();
      render.render(restoreStrokeRect);
    };
  });
});
