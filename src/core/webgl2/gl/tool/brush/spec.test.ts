import { describe, it } from "vitest";
import { SplineModule } from "./strokeModule/splineModule";
import { CapsuleModule } from "./strokeModule/capsuleModule";
import { CapsuleHardModule } from "./strokeModule/capsuleHardModule";
import { PencilModule } from "./strokeModule/pencilModule";
import { BrushRenderModule } from "./renderModule";

describe("brushModule 사용법", () => {
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

      // alphaMapTexture: 브러시 경로(stroke)가 누적되는 마스크.
      // strokeModule이 쓰고, renderModule이 읽는다. 두 모듈이 이 텍스쳐를 공유한다.
      const alphaMapTexture = gl.createTexture()!;

      // strokeModule 종류 (모두 동일한 인터페이스 → renderModule은 교체를 모른다):
      //   SplineModule      - spline 보간, 부드러운 브러시 (기본값)
      //   CapsuleModule     - distance shader 기반, AA 있는 원형 브러시
      //   CapsuleHardModule - distance shader 기반, AA 없는 픽셀 단위 브러시
      //   PencilModule      - Bresenham 알고리즘, 1px 정밀 연필
      const stroke = SplineModule(gl, { alphaMapTexture, width, height });
      // const stroke = CapsuleModule(gl, { alphaMapTexture, width, height });
      // const stroke = CapsuleHardModule(gl, { alphaMapTexture, width, height });
      // const stroke = PencilModule(gl, { alphaMapTexture, width, height });

      const render = BrushRenderModule(gl, {
        imageTexture,
        resultTexture,
        maskTexture: alphaMapTexture,
        width,
        height,
      });

      stroke.setAlpha(1);
      stroke.setDiameter(20);
      render.setColor([0, 0, 0, 1]);
      render.setMode("brush");

      // 브러시 스트로크: start -> move... -> end
      // stroke가 dirty rect를 반환 → 해당 영역만 render한다.
      const previewRect1 = stroke.start({ x: 100, y: 100 });
      render.render(previewRect1); // alphaMapTexture를 보고 해당 rect만 resultTexture에 합성

      const previewRect2 = stroke.move({ x: 130, y: 110 });
      render.render(previewRect2);

      const strokeRect = stroke.end(); // 이 스트로크 전체의 bounding rect 반환
      render.render(strokeRect);
      // 외부에서 strokeRect 범위의 resultTexture를 imageTexture에 커밋하고 히스토리를 만든다.
      // 그 후 strokeRect 범위의 alphaMapTexture를 지운다.

      // cancel일 때
      const previewRect3 = stroke.start({ x: 200, y: 200 });
      render.render(previewRect3);
      const previewRect4 = stroke.move({ x: 230, y: 210 });
      render.render(previewRect4);

      const strokeRect2 = stroke.end();
      // strokeRect2 범위의 resultTexture에 imageTexture로 덮어쓴다. 히스토리는 만들지 않음.
      // 그 후 strokeRect2 범위의 alphaMapTexture를 지운다.
      // 덮어쓰기 때문에 resultTexture를 수정하는 render.render(strokeRect2);는 안해도 된다.

      // eraser 모드 (commit/cancel 방식은 brush 모드와 동일하다)
      render.setMode("eraser");
      const previewRect5 = stroke.start({ x: 300, y: 300 });
      render.render(previewRect5);
      const previewRect6 = stroke.move({ x: 330, y: 310 });
      render.render(previewRect6);
      const strokeRect3 = stroke.end();
      render.render(strokeRect3);
    };
  });
});
