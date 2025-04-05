import { PaintService } from "./paintService";

let paint: PaintService;

export const workerApi = {
  async makeLayer(
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
  ) {
    console.log("Making Layer...", width, height);

    paint = new PaintService(
      main_canvas,
      width,
      height,
      screenWidth,
      screenHeight,
      dpr,
    );
  },
  render(width, height, screenWidth, screenHeight, x, y, magnification) {
    paint.render(width, height, screenWidth, screenHeight, x, y, magnification);
  },
  setStrokeColor(r, g, b) {
    paint.setStrokeColor(r, g, b);
  },
  setStrokeSize(size) {
    paint.setStrokeSize(size);
  },
  setAlpha(alpha) {
    paint.setAlpha(alpha);
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
  canvasSelection(x,y,w,h){
     paint.canvasSelection(x,y,w,h);
  },
  makeSelection(x, y, width, height, imageBitmap) {
    paint.makeSelection(x, y, width, height, imageBitmap);
  },
  moveSelection(x, y, width, height) {
    paint.moveSelection(x, y, width, height);
  },
  applySelection() {
    paint.applySelection();
  },
  copy() {
    // worker.js
    self.postMessage({ type: "copy", payload: "복사해줘" });
  },
};

interface Pointer {
  x: number;
  y: number;
}
