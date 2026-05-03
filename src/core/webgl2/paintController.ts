import { paintOptions } from "./gl/texture";
import { RendererInterface } from "../RendererInterface";
import { PaintService } from "./paintService";
import type { CoreTool, CoreToolState, Pointer } from "../types.js";
import { HistoryResponse } from "../history/history";

let paint: PaintService;

export class WebGL2Controller {
  async install(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    px: number,
    py: number,
    scale: number,
  ): Promise<void> {
    let { x, y } = toWebglCoord3(px, py, width, height, screenWidth, screenHeight, scale);

    paintOptions.screenWidth = screenWidth;
    paintOptions.screenHeight = screenHeight;
    paintOptions.dpr = dpr;
    paintOptions.width = width;
    paintOptions.height = height;

    paintOptions.x = x;
    paintOptions.y = y;

    paintOptions.magnification = scale;

    main_canvas.width = screenWidth;
    main_canvas.height = screenHeight;

    paint = new PaintService(main_canvas);
    await paint.initialize();
  }

  setLayerId(layerId: string | number): void {
    paint.setLayerId(layerId);
  }
  setCameraPosition(px: number, py: number, magnification: number): void {
    let { x, y } = toWebglCoord3(
      px,
      py,
      paintOptions.width,
      paintOptions.height,
      paintOptions.screenWidth,
      paintOptions.screenHeight,
      magnification,
    );
    paint.setCameraPosition(x, y, magnification);
  }
  resizeLayer(px: number, py: number, width: number, height: number): void {
    const newY = paintOptions.height - height - py;
    paint.resizeLayer(px, newY, width, height);
  }
  resizeScreenSize(screenWidth: number, screenHeight: number): void {
    paint.resizeScreen(screenWidth, screenHeight);
  }
  render(): void {
    paint.render();
  }
  setStrokeColor(r: number, g: number, b: number): void {
    paint.setStrokeColor(r, g, b);
  }
  setStrokeSize(size: number): void {
    paint.setStrokeSize(size);
  }
  setAlpha(alpha: number): void {
    paint.setAlpha(alpha / 100);
  }
  setTool(toolId: CoreTool, doExit: boolean = true): CoreToolState {
    return paint.setTool(toolId, doExit);
  }
  start(p: Pointer): void {
    let pointer = toWebglCoord(p);
    paint.start(pointer);
  }
  strokeTo(p: Pointer): void {
    let pointer = toWebglCoord(p);
    paint.strokeTo(pointer);
  }
  end(): void {
    paint.end();
  }
  cancel(): void {
    paint.cancel();
  }
  select(px: number, py: number, w: number, h: number): void {
    let { x, y } = toWebglCoord2(px, py, w, h);
    paint.select(x, y, w, h);
  }
  endMove(): void {
    paint.endSelection();
  }
  moveSelection(px: number, py: number, width: number, height: number, flipH = false, flipV = false): void {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.moveSelection(x, y, width, height, flipH, flipV);
  }
  applySelection(): void {
    paint.applySelection();
  }

  selectionDelete(): void {
    paint.selectionDelete();
  }
  paste(px: number, py: number, width: number, height: number, imageBitmap: ImageBitmap): void {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.paste(x, y, width, height, imageBitmap);
  }

  getSelectionPixel(): PixelData {
    return paint.getSelectionPixel();
  }
  cut(): PixelData {
    return paint.cut();
  }
  downloadImage(): PixelData {
    return paint.downloadImage();
  }

  uploadImage(bitmap: ImageBitmap): void {
    return paint.uploadImage(bitmap);
  }
  resetImage(width: number, height: number): void {
    return paint.resetImage(width, height);
  }

  async undo(): Promise<HistoryResponse | null> {
    return paint.undo();
  }
  async redo(): Promise<HistoryResponse | null> {
    return paint.redo();
  }

  getHistoryCount(): HistoryCount {
    return paint.getHistoryCount();
  }

  getServiceType(): "canvas2d" | "webgl" | "webgpu" {
    return "webgl";
  }

  isInitialized(): boolean {
    return true; // Canvas2D는 항상 사용 가능
  }

  destroy(): void {
    // SplineTool에서 리소스 정리하도록 위임 (필요시)
  }
}

function toWebglCoord(pointer: Pointer): { x: number; y: number } {
  let { x, y } = pointer;
  return {
    x,
    y: paintOptions.height - y,
  };
}

function toWebglCoord2(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  return {
    x,
    y: paintOptions.height - y - h,
    w,
    h,
  };
}

function toWebglCoord3(
  x: number,
  y: number,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
  scale: number,
): { x: number; y: number } {
  let newY = -y + screenHeight / scale - height;
  return {
    x,
    y: newY,
  };
}

interface HistoryCount {
  undoCount: number;
  redoCount: number;
}

interface PixelData {
  pixels: Uint8ClampedArray<ArrayBufferLike>;
  width: number;
  height: number;
}
