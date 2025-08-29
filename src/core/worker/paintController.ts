import { paintOptions } from "../gl/texture";
import { IRenderService } from "../IRenderService";
import { PaintService } from "./paintService";

let paint: PaintService;

export class WebGL2Service implements IRenderService {
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
    let { x, y } = toWebglCoord3(
      px,
      py,
      width,
      height,
      screenWidth,
      screenHeight,
      scale
    );

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
  }
  setLayerId(layerId) {
    paint.setLayerId(layerId);
  }
  setCameraPosition(px, py, magnification) {
    let { x, y } = toWebglCoord3(
      px,
      py,
      paintOptions.width,
      paintOptions.height,
      paintOptions.screenWidth,
      paintOptions.screenHeight,
      magnification
    );
    paint.setCameraPosition(x, y, magnification);
  }
  resizeLayer(px, py, width, height) {
    const diffH = paintOptions.height - height;
    let newY;

    if (py !== 0) {
      newY = 0;
    } else {
      newY = py + diffH;
    }
    paint.resizeLayer(px, newY, width, height);
  }
  resizeScreenSize(screenWidth, screenHeight) {
    paint.resizeScreen(screenWidth, screenHeight);
  }
  render() {
    paint.render();
  }
  setStrokeColor(r, g, b) {
    paint.setStrokeColor(r, g, b);
  }
  setStrokeSize(size) {
    paint.setStrokeSize(size);
  }
  setAlpha(alpha) {
    paint.setAlpha(alpha / 100);
  }
  setTool(toolId, doExit = true) {
    paint.setTool(toolId, doExit);
  }
  start(p: Pointer) {
    let pointer = toWebglCoord(p);
    paint.start(pointer);
  }
  strokeTo(p: Pointer) {
    let pointer = toWebglCoord(p);
    paint.strokeTo(pointer);
  }
  end() {
    paint.end();
  }
  cancel() {
    paint.cancel();
  }
  select(px, py, w, h) {
    let { x, y } = toWebglCoord2(px, py, w, h);
    paint.select(x, y, w, h);
  }
  endMove() {
    paint.endMove();
  }
  moveSelection(px, py, width, height) {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.moveSelection(x, y, width, height);
  }
  applySelection() {
    paint.applySelection();
  }
  paste(px, py, width, height, imageBitmap) {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.paste(x, y, width, height, imageBitmap);
  }
  copy() {
    paint.copy();
  }
  cut() {
    paint.cut();
  }
  selectionDelete() {
    paint.selectionDelete();
  }
  uploadImage(bitmap) {
    paint.uploadImage(bitmap);
  }
  resetImage(width, height) {
    paint.resetImage(width, height);
  }
  downloadImage() {
    paint.downloadImage();
  }
  undo() {
    return paint.undo();
  }
  redo() {
    return paint.redo();
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
