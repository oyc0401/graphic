import type { IRenderService } from "./IRenderService";
import { Canvas2DService } from "./canvas2d/Canvas2DService";
import { WebGPUService } from "./webgpu/WebGPUService";
import { workerApi } from "./worker/paintController";

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

export class DrawingController {
  private renderService!: IRenderService;

  async makeLayer(
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
    // let { x, y } = toWebglCoord3(
    //   px,
    //   py,
    //   width,
    //   height,
    //   screenWidth,
    //   screenHeight,
    //   scale
    // );

    // paintOptions.screenWidth = screenWidth;
    // paintOptions.screenHeight = screenHeight;
    // paintOptions.dpr = dpr;
    // paintOptions.width = width;
    // paintOptions.height = height;

    // paintOptions.x = x;
    // paintOptions.y = y;

    // paintOptions.magnification = scale;

    // main_canvas.width = screenWidth;
    // main_canvas.height = screenHeight;

    // WebGPU 지원 여부 체크
    // const supportsWebGPU = false; //this.checkWebGPUSupport();

    // if (supportsWebGPU) {
    //   console.log("WebGPU supported - attempting initialization");
    //   this.initializeWebGPU(main_canvas);
    // } else {
    //   console.log("WebGPU not supported - using Canvas2D fallback");
    //   this.renderService = new Canvas2DService(main_canvas);
    // }

    this.renderService = new workerApi(main_canvas);
    await this.renderService.makeLayer(
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
  }

  // private checkWebGPUSupport(): boolean {
  //   try {
  //     const testCanvas = document.createElement("canvas");
  //     const testCtx = testCanvas.getContext("webgpu");
  //     return testCtx !== null;
  //   } catch (error) {
  //     return false;
  //   }
  // }

  // private async initializeWebGPU(canvas: HTMLCanvasElement): Promise<void> {
  //   try {
  //     const webgpuService = new WebGPUService(canvas);
  //     const success = await webgpuService.initialize();

  //     if (success) {
  //       console.log("WebGPU service initialized successfully");
  //       this.renderService = webgpuService;
  //     } else {
  //       console.log("WebGPU initialization failed - falling back to Canvas2D");
  //       this.renderService = new Canvas2DService(canvas);
  //     }
  //   } catch (error) {
  //     console.error("WebGPU initialization error:", error);
  //     console.log("Using Canvas2D fallback");
  //     this.renderService = new Canvas2DService(canvas);
  //   }
  // }

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
    paintOptions.color = { r, g, b };
  }

  setStrokeSize(size: number): void {
    paintOptions.diameter = size;
  }

  setAlpha(alpha: number): void {
    paintOptions.alpha = alpha;
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
