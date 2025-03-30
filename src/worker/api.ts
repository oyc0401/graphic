import { PaintAPI } from "./apiManager";

let paint: PaintAPI;

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

    paint = new PaintAPI(
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
    let radius = size; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    paint.setStrokeSize(radius);
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

  selectionMake(){
    
  },
  selectionMove(){
    
  },
  selectionApply(){
    
  },
  undo(){
    // 히스토리는 각각의 레이어로 구성됌
  },
  redo(){
    
  }
};

interface Pointer {
  x: number;
  y: number;
}
