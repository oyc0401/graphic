import { PaintLayer } from "./paintLayer";

let layer: PaintLayer;

export const workerApi = {
  async makeLayer(
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
    dpr:number,
  ) {
    console.log("Making Layer...", width, height);

    layer = new PaintLayer(
      main_canvas,
      width,
      height,
      screenWidth,
      screenHeight,
      dpr
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
  setTool(toolId) {
    layer.setTool(toolId);
  },

  start(pointer: Pointer) {
    layer.start(pointer);
  },
  strokeTo(pointer: Pointer) {
    layer.strokeTo(pointer);
  },
  end() {
    layer.end();
  },
  cancel() {
    layer.cancel();
  },
};

interface Pointer {
  x: number;
  y: number;
}
