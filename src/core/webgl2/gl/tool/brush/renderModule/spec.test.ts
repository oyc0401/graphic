import { describe, it } from "vitest";
import { BrushRenderModule } from "./index";

describe("BrushRenderModule", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;
      const width = 0,
        height = 0,
        x = 0,
        y = 0;

      // 원본이미지가 담긴 텍스쳐
      const texture = gl.createTexture()!;

      // 해당 텍스쳐는 정확히 그대로 화면 어딘가에 보여집니다.
      const renderTexture = gl.createTexture()!;

      // 마스크는 외부에서 소유하고, render 모듈은 이 텍스쳐를 읽기만 합니다.
      const maskTexture = gl.createTexture()!;

      interface BrushRenderInterface {
        // color의 4번째 성분은 전역 알파. replace 모드에서 교체될 픽셀의 알파로 사용된다.
        setColor(color: [number, number, number, number]): void;
        // replace: source-over 합성 대신 스트로크가 덮는 픽셀을 (color, alpha)로 교체한다.
        setMode(mode: "brush" | "eraser" | "replace"): void;
        render(rect: { x: number; y: number; width: number; height: number }): void;
      }

      const brushRender: BrushRenderInterface = BrushRenderModule(gl, {
        imageTexture: texture,
        resultTexture: renderTexture,
        maskTexture,
        width,
        height,
      });

      brushRender.setColor([1, 1, 1, 1]);
      brushRender.setMode("eraser");
      brushRender.setMode("replace");

      // 이걸 하면 렌더링됌.
      brushRender.render({ x, y, width, height });
    };
  });
});
