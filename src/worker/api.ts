import { PaintLayer } from "./paintLayer";

let layer: PaintLayer;

export const workerApi = {
  async makeLayer(
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
  ) {
    console.log("make layer", width, height);

    layer = new PaintLayer(
      main_canvas,
      width,
      height,
      screenWidth,
      screenHeight,
    );
  },
  render(width, height, screenWidth, screenHeight, x, y, magnification) {
    layer.render(width, height, screenWidth, screenHeight, x, y, magnification);
  },
  setStrokeColor(r, g, b) {
    layer.setStrokeColor(r, g, b);
  },
  setStrokeSize(size) {
    let radius = (size - 1) / 2 + 1; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    layer.setStrokeSize(radius);
  },
  setAlpha(alpha) {
    layer.setAlpha(alpha);
  },
  drawStart(pointer: Pointer) {
    layer.drawStart(pointer);
  },
  drawTo(pointer: Pointer) {
    layer.drawTo(pointer);
  },
  drawEnd() {
    layer.drawEnd();
  },
  cancel() {
    layer.cancel();
  },
  eraserStart(pointer: Pointer) {
    layer.eraserStart(pointer);
  },
  eraserTo(pointer: Pointer) {
    layer.eraserTo(pointer);
  },
  eraserEnd() {
    layer.drawEnd();
  },
  liquifyStart(pointer: Pointer) {
    layer.liquifyStart(pointer);
  },
  liquifyTo(pointer: Pointer) {
    layer.liquifyTo(pointer);
  },
  liquifyCancel() {
    layer.liquifyCancel();
  },
  liquifyEnd() {
    layer.liquifyEnd();
  },
  liquifyFinish() {
    layer.liquifyFinish();
  },
};

interface Pointer {
  x: number;
  y: number;
}
