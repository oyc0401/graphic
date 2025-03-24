import { PaintLayer } from "./paintLayer";

let layer: PaintLayer;

export const workerApi = {
  async makeLayer(
    layerId: string,
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
  ) {
    console.log("make layer", width, height);

    layer = new PaintLayer(
      layerId,
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
  setStrokeColor(layerId, r, g, b) {
    layer.setStrokeColor(r, g, b);
  },
  setStrokeSize(layerId, size) {
    let radius = (size - 1) / 2 + 1; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    layer.setStrokeSize(radius);
  },
  setAlpha(layerId, alpha) {
    layer.setAlpha(alpha);
  },
  drawStart(layerId: string, pointer: Pointer) {
    layer.drawStart(pointer);
  },
  drawTo(layerId: string, pointer: Pointer) {
    layer.drawTo(pointer);
  },
  drawEnd(layerId: string) {
    layer.drawEnd();
  },
  eraserStart(layerId: string, pointer: Pointer) {
    layer.eraserStart(pointer);
  },
  eraserTo(layerId: string, pointer: Pointer) {
    layer.eraserTo(pointer);
  },
  eraserEnd(layerId: string) {
    layer.drawEnd();
  },
  liquifyStart(layerId: string, pointer: Pointer) {
    layer.liquifyStart(pointer);
  },
  liquifyTo(layerId: string, pointer: Pointer) {
    layer.liquifyTo(pointer);
  },
  liquifyCancel(layerId: string) {;
    layer.liquifyCancel();
  },
  liquifyEnd(layerId: string) {
    layer.liquifyEnd();
  },
  liquifyReset(layerId: string) {
    layer.liquifyFinish();
  },
  cancel(layerId) {
    layer.cancel();
  },
};

interface Pointer {
  x: number;
  y: number;
}