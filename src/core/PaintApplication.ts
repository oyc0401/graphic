import { WebGL2Controller } from "./webgl2/paintController";

export class PaintApplication {
  static async install(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    px: number,
    py: number,
    scale: number,
    image?: ImageBitmap | null,
  ): Promise<WebGL2Controller> {
    const webgl2Service = new WebGL2Controller();
    await webgl2Service.install(
      main_canvas,
      screenWidth,
      screenHeight,
      dpr,
      width,
      height,
      px,
      py,
      scale,
      image,
    );

    return webgl2Service;
  }
}
