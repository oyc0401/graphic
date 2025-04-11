import { getLayerManager } from "../gl/layer";
import { paintOptions } from "../gl/texture";
import { PaintService } from "./paintService";

let paint: PaintService;

export const workerApi = {
  async makeLayer(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    x: number,
    y: number,
    scale: number,
  ) {
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
  },
  setLayerId(layerId) {
    paint.setLayerId(layerId);
  },
  setCamaraPosition(x, y, magnification) {
    paint.setCameraPosition(x, y, magnification);
  },
  resizeLayer(width, height) {
    paint.resizeLayer(width, height);
  },
  resizeScreenSize(screenWidth, screenHeight) {
    paint.resizeScreen(screenWidth, screenHeight);
  },
  render() {
    paint.render();
  },
  setStrokeColor(r, g, b) {
    paint.setStrokeColor(r, g, b);
  },
  setStrokeSize(size) {
    paint.setStrokeSize(size);
  },
  setAlpha(alpha) {
    paint.setAlpha(alpha / 100);
  },
  setTool(toolId) {
    paint.setTool(toolId);
  },

  start(pointer: Pointer) {
    paint.start(pointer);
  },
  strokeTo(pointer: Pointer) {
    paint.strokeTo(pointer);
  },
  end() {
    paint.end();
  },
  cancel() {
    paint.cancel();
  },
  select(x, y, w, h) {
    paint.select(x, y, w, h);
  },
  moveSelection(x, y, width, height) {
    paint.moveSelection(x, y, width, height);
  },
  applySelection() {
    paint.applySelection();
  },
  paste(x, y, width, height, imageBitmap) {
    paint.paste(x, y, width, height, imageBitmap);
  },
  copy() {
    paint.copy();
  },
  cut() {
    paint.cut();
  },
};

interface Pointer {
  x: number;
  y: number;
}
