import { paintOptions } from "../DrawingController.js";
import type { IRenderService } from "../IRenderService";
import { SplineTool } from "./SplineTool";
import type { Pointer } from "../types";

export class Canvas2DService implements IRenderService {
  private splineTool: SplineTool;

  constructor(canvas: HTMLCanvasElement) {
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
