import type { RendererInterface } from "./RendererInterface";
import { Canvas2DService } from "./canvas2d/Canvas2DService";
import { WebGPUService } from "./webgpu/WebGPUService";
import { WebGL2Controller } from "./worker/paintController";

export class PaintApplication {
  private renderer!: RendererInterface;

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
    // try {
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
    // } catch (e) {
    // let canvas2dService = new Canvas2DService();
    // await canvas2dService.install(main_canvas);
    // this.renderService = canvas2dService;
    // }
  }

  start(pointer: Pointer): void {
    this.renderer.start(pointer);
  }

  strokeTo(pointer: Pointer): void {
    this.renderer.strokeTo(pointer);
  }

  end(): void {
    this.renderer.end();
  }

  cancel(): void {
    this.renderer.cancel();
  }

  setStrokeColor(r: number, g: number, b: number): void {
    this.renderer.setStrokeColor(r, g, b);
  }

  setStrokeSize(size: number): void {
    this.renderer.setStrokeSize(size);
  }

  setAlpha(alpha: number): void {
    this.renderer.setAlpha(alpha);
  }

  setLayerId(layerId: string | number): void {
    this.renderer.setLayerId(layerId);
  }

  // === 카메라 및 뷰포트 ===
  setCameraPosition(px: number, py: number, magnification: number): void {
    this.renderer.setCameraPosition(px, py, magnification);
  }

  resizeLayer(px: number, py: number, width: number, height: number): void {
    this.renderer.resizeLayer(px, py, width, height);
  }

  resizeScreenSize(screenWidth: number, screenHeight: number): void {
    this.renderer.resizeScreenSize(screenWidth, screenHeight);
  }

  render(): void {
    this.renderer.render();
  }

  // === 도구 관리 ===
  setTool(toolId: string | number, doExit?: boolean): void {
    this.renderer.setTool(toolId, doExit);
  }

  // === 선택 영역 관리 ===
  select(px: number, py: number, w: number, h: number): void {
    this.renderer.select(px, py, w, h);
  }

  endMove(): void {
    this.renderer.endMove();
  }

  moveSelection(px: number, py: number, width: number, height: number): void {
    this.renderer.moveSelection(px, py, width, height);
  }

  applySelection(): void {
    this.renderer.applySelection();
  }

  // === 클립보드 작업 ===
  paste(
    px: number,
    py: number,
    width: number,
    height: number,
    imageBitmap: ImageBitmap
  ): void {
    this.renderer.paste(px, py, width, height, imageBitmap);
  }

  copy(): void {
    this.renderer.copy();
  }

  cut(): void {
    this.renderer.cut();
  }

  selectionDelete(): void {
    this.renderer.selectionDelete();
  }

  // === 이미지 관리 ===
  uploadImage(bitmap: ImageBitmap): void {
    this.renderer.uploadImage(bitmap);
  }

  resetImage(width: number, height: number): void {
    this.renderer.resetImage(width, height);
  }

  downloadImage(): void {
    this.renderer.downloadImage();
  }

  // === 실행 취소/다시 실행 ===
  undo(): Promise<string> {
    return this.renderer.undo();
  }

  redo(): Promise<string> {
    return this.renderer.redo();
  }
}

interface Pointer {
  x: number;
  y: number;
}
