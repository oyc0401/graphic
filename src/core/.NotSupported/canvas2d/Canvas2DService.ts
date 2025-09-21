import type { RendererInterface } from "../RendererInterface";
import { SplineTool } from "./SplineTool";
import type { Pointer } from "../types";

export const paintOptions = {
  width: 100,
  height: 100,
  dpr: 1,
  diameter: 10,
  color: { r: 0, g: 0, b: 0 },
  alpha: 0.5,

  radius: 10,
  x: 0,
  y: 0,
  magnification: 1,

  screenWidth: 800,
  screenHeight: 800,
};

export class Canvas2DService implements RendererInterface {
  private splineTool: SplineTool;

  async install(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    this.splineTool = new SplineTool(canvas, ctx);
  }

  start(pointer: Pointer): void {
    this.splineTool.start(pointer);
  }

  strokeTo(pointer: Pointer): void {
    this.splineTool.strokeTo(pointer);
  }

  end(): void {
    this.splineTool.end();
  }

  cancel(): void {
    this.splineTool.cancel();
  }

  getServiceType(): "canvas2d" | "webgl" | "webgpu" {
    return "canvas2d";
  }

  isInitialized(): boolean {
    return true; // Canvas2D는 항상 사용 가능
  }

  destroy(): void {
    // SplineTool에서 리소스 정리하도록 위임 (필요시)
  }
}
