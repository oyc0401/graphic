import { describe, it } from "vitest";
import { createFloodFill } from ".";

describe("floodFillModule", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;

      const width = canvas.width;
      const height = canvas.height;

      // 원본 이미지가 담긴 텍스처
      const imageTexture = gl.createTexture()!;

      // 실제 화면에 보여지는 텍스쳐
      const resultTexture = gl.createTexture()!;

      type Rect = { x: number; y: number; width: number; height: number };

      interface FloodFillInterface {
        setTolerance(tolerance: number): void;
        setAlpha(alpha: number): void;
        setColor(color: [number, number, number]): void;
        fill(point: { x: number; y: number }): Rect;
      }

      const floodFill: FloodFillInterface = createFloodFill(gl, {
        imageTexture,
        resultTexture,
        width,
        height,
      });

      floodFill.setTolerance(0.12); // 이걸 하면, 클릭한 픽셀과 어느 정도 비슷한 색까지 채울지 정해짐
      floodFill.setAlpha(0.1); // 이걸 하면, 채우는 색이 기존 색에 어느 정도 덮어질지 정해짐
      floodFill.setColor([1, 0, 0]);

      // 이걸 하면 resultTexture가 수정됌
      const rect = floodFill.fill({ x: 10, y: 10 });

      // 외부에서는 이 rect를 가지고 resultTexture를 기반으로 히스토리를 만들거임.

      // 대충 resultTexture를 화면 어딘가에 렌더링한다는 함수
      function render() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.bindTexture(gl.TEXTURE_2D, resultTexture);

        // resultTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      render();
    };
  });
});
