import type { RendererInterface } from "./RendererInterface";
import { Canvas2DService } from "./canvas2d/Canvas2DService";
import { WebGPUService } from "./webgpu/WebGPUService";
import { WebGL2Controller } from "./webgl2/paintController";

export class PaintApplication {
  private renderer!: WebGL2Controller;

  async install(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    px: number,
    py: number,
    scale: number
  ) {
    try {
      let webgl2Service = new WebGL2Controller();
      await webgl2Service.install(
        main_canvas,
        screenWidth,
        screenHeight,
        dpr,
        width,
        height,
        px,
        py,
        scale
      );

      this.renderer = webgl2Service;
    } catch (e) {
      // let canvas2dService = new Canvas2DService();
      // await canvas2dService.install(
      //   main_canvas,
      //   screenWidth,
      //   screenHeight,
      //   dpr,
      //   width,
      //   height,
      //   px,
      //   py,
      //   scale
      // );
      // this.renderService = canvas2dService;
    }
  }

  get service() {
    return this.renderer;
  }
}
