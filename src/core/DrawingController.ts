import type { IRenderService } from "./IRenderService";
import { Canvas2DService } from "./canvas2d/Canvas2DService";
import { WebGPUService } from "./webgpu/WebGPUService";
import { WebGL2Service } from "./worker/paintController";

export class DrawingController {
  private renderService!: IRenderService;

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
      let webgl2Service = new WebGL2Service();
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

      this.renderService = webgl2Service;
    } catch (e) {
      let canvas2dService = new Canvas2DService();
      await canvas2dService.install(main_canvas);
      this.renderService = canvas2dService;
    }
  }

  start(pointer: Pointer): void {
    this.renderService.start(pointer);
  }

  strokeTo(pointer: Pointer): void {
    this.renderService.strokeTo(pointer);
  }

  end(): void {
    this.renderService.end();
  }

  cancel(): void {
    this.renderService.cancel();
  }

  setStrokeColor(r: number, g: number, b: number): void {
    this.renderService.setStrokeColor(r, g, b);
  }

  setStrokeSize(size: number): void {
    this.renderService.setStrokeSize(size);
  }

  setAlpha(alpha: number): void {
    this.renderService.setAlpha(alpha);
  }

  setLayerId(layerId: string | number): void {
    this.renderService.setLayerId(layerId);
  }

  // === 카메라 및 뷰포트 ===
  setCameraPosition(px: number, py: number, magnification: number): void {
    this.renderService.setCameraPosition(px, py, magnification);
  }

  resizeLayer(px: number, py: number, width: number, height: number): void {
    this.renderService.resizeLayer(px, py, width, height);
  }

  resizeScreenSize(screenWidth: number, screenHeight: number): void {
    this.renderService.resizeScreenSize(screenWidth, screenHeight);
  }

  render(): void {
    this.renderService.render();
  }

  // === 도구 관리 ===
  setTool(toolId: string | number, doExit?: boolean): void {
    this.renderService.setTool(toolId, doExit);
  }

  // === 선택 영역 관리 ===
  select(px: number, py: number, w: number, h: number): void {
    this.renderService.select(px, py, w, h);
  }

  endMove(): void {
    this.renderService.endMove();
  }

  moveSelection(px: number, py: number, width: number, height: number): void {
    this.renderService.moveSelection(px, py, width, height);
  }

  applySelection(): void {
    this.renderService.applySelection();
  }

  // === 클립보드 작업 ===
  paste(
    px: number,
    py: number,
    width: number,
    height: number,
    imageBitmap: ImageBitmap
  ): void {
    this.renderService.paste(px, py, width, height, imageBitmap);
  }

  copy(): void {
    this.renderService.copy();
  }

  cut(): void {
    this.renderService.cut();
  }

  selectionDelete(): void {
    this.renderService.selectionDelete();
  }

  // === 이미지 관리 ===
  uploadImage(bitmap: ImageBitmap): void {
    this.renderService.uploadImage(bitmap);
  }

  resetImage(width: number, height: number): void {
    this.renderService.resetImage(width, height);
  }

  downloadImage(): void {
    this.renderService.downloadImage();
  }

  // === 실행 취소/다시 실행 ===
  undo(): boolean {
    return this.renderService.undo();
  }

  redo(): boolean {
    return this.renderService.redo();
  }
}

interface Pointer {
  x: number;
  y: number;
}

function toWebglCoord(pointer) {
  let { x, y } = pointer;
  return {
    x,
    y: paintOptions.height - y,
  };
}

function toWebglCoord2(x, y, w, h) {
  return {
    x,
    y: paintOptions.height - y - h,
    w,
    h,
  };
}

function toWebglCoord3(x, y, width, height, screenWidth, screenHeight, scale) {
  let newY = -y + screenHeight / scale - height;
  return {
    x,
    y: newY,
  };
}
