import { describe, it } from "vitest";
import { SplineModule } from "./index";

describe("splineModule", () => {
  it("스펙을 만족해야 한다", () => {
    const _: () => void = () => {
      const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2")!;

      const width = canvas.width;
      const height = canvas.height;

      const alphaMapTexture = gl.createTexture()!;

      type Rect = { x: number; y: number; width: number; height: number };

      interface SplineModuleInterface {
        setAlpha(alpha: number): void;
        setDiameter(diameter: number): void;
        start(point: { x: number; y: number }): Rect | null;
        move(point: { x: number; y: number }): Rect | null;
        end(): Rect | null;
      }

      const module: SplineModuleInterface = SplineModule(gl, {
        alphaMapTexture,
        width,
        height,
      });

      module.setAlpha(1);
      module.setDiameter(20);

      // p1 -> p2는 spline으로 부드럽게 픽셀을 찍는다.
      // diameter 20이면 spline 경로에 둥근 브러시가 찍힌다.
      // start할때도 알파맵이 수정된다.

      // 이 rect를 외부에서 받으면 소스텍스쳐 일부분 + 알파맵의 일부분을 사용해서
      // resultTextue의 일부분을 수정한다.
      const previewRect1 = module.start({ x: 10, y: 10 });

      // 이걸 하면 알파맵이 수정됌
      const previewRect2 = module.move({ x: 40, y: 24 });
      // 이걸 하면 알파맵이 수정됌
      const previewRect3 = module.move({ x: 72, y: 24 });
      // 이걸 하면 이번 stroke의 Rect를 리턴함.
      const strokeRect1 = module.end(); // 이 rect를 가지고 외부에서 resultTexture을 소스텍스쳐에 붙여넣기하고, 소스텍스쳐를 기반으로 히스토리를 만들거임.

      // 뭔가 작업을 끝내고 이제 알파맵이 필요없어졌을 때. 외부에서 strokeRect1 해당하는 알파맵을 지운다.

      // cancel이 됐을 때
      const previewRect4 = module.start({ x: 120, y: 88 });
      const previewRect5 = module.move({ x: 180, y: 88 });
      // 외부에서 cancel하면 그냥 안쓰면 됌
      const strokeRect2 = module.end(); // 외부에서 캔슬을 하면 이부분의 resultTexture를 소스텍스쳐로 덮어쓴다. 히스토리는 만들지 않음.
    };
  });
});
