import { getGlHelper } from "./glHelper";
import { getLiquifyManager } from "./liquify/liquify";
import { getBrushManager, renderScreen } from "./tools";
import { paintOptions } from "./texture";
interface Pointer {
  x: number;
  y: number;
}

export class PaintLayer {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;

  tool: string;
  lastPointer: Pointer;

  drawManager;
  liquifyManager;

  constructor(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
  ) {
    this.canvas = canvas;
    let gl = canvas.getContext("webgl2", {
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
      //premultipliedAlpha: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    paintOptions.width = width;
    paintOptions.height = height;
    paintOptions.screenWidth = width;
    paintOptions.screenHeight = screenHeight;

    this.init();
  }

  async init() {
    this.drawInit();
    this.eraserInit();
    await this.liquifyInit();
  }

  clear() {
    let glHelper = getGlHelper(this.gl);
    glHelper.clearRect(0, 0, this.width, this.height);
  }

  render(width, height, screenWidth, screenHeight, x, y, magnification) {
    renderScreen(
      this.canvas,
      this.gl,
      width,
      height,
      screenWidth,
      screenHeight,
      x,
      y,
      magnification,
    );
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;

    this.drawManager.setSize();
    this.liquifyManager.setSize();
  }

  setStrokeColor(r, g, b) {
    paintOptions.setColor({ r, g, b });
  }

  setStrokeSize(strokeSize) {
    paintOptions.setRadius(strokeSize);
  }

  setAlpha(alpha) {
    paintOptions.setAlpha(alpha);
  }

  drawInit() {
    this.drawManager = getBrushManager(this.canvas, this.gl);
  }
  drawStart(pointer: Pointer) {
    this.lastPointer = pointer;
  }

  drawTo(pointer: Pointer) {
    this.drawManager.stroke(this.lastPointer, pointer);
    this.drawManager.brush();
    this.lastPointer = pointer;
  }

  drawCancel() {
    this.drawManager.cancel();
  }

  drawEnd() {
    this.drawManager.end();
  }

  eraserInit() {
    this.drawManager = getBrushManager(this.canvas, this.gl);
  }
  eraserStart(pointer: Pointer) {
    this.lastPointer = pointer;
  }

  eraserTo(pointer: Pointer) {
    this.drawManager.stroke(this.lastPointer, pointer);
    this.drawManager.eraser();
    this.lastPointer = pointer;
  }
  cancel() {
    this.drawManager.cancel();
  }

  eraserEnd() {
    this.drawManager.reset();
  }

  async liquifyInit() {
    this.liquifyManager = await getLiquifyManager(this.canvas, this.gl);
  }
  async liquifyStart(pointer: Pointer) {
    this.lastPointer = pointer;
    this.liquifyManager.startStroke(pointer);
  }
  liquifyTo(pointer: Pointer) {
    this.liquifyManager.push(this.lastPointer, pointer);
    this.liquifyManager.render();
    this.lastPointer = pointer;
  }
  liquifyCancel() {
    this.liquifyManager.cancel();
  }

  liquifyEnd() {
    this.liquifyManager.endStroke();
  }

  liquifyFinish() {
    console.log("리퀴파이 finish!");
    this.liquifyManager.finish();
  }

  // appendHistory() {
  //   // 지금 상태를 히스토리에 넣기!

  //   let imageTexture = makeImageTex(this.canvas, this.gl);
  //   history.push(imageTexture);
  // }
}
