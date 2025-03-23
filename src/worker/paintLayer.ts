import { getGlHelper } from "./glHelper";
import { getLiquifyManager } from "./liquify/liquify";
import { getBrushManager, paintOptions, renderScreen } from "./tools";

interface Pointer {
  x: number;
  y: number;
}

let history = [];

export class PaintLayer {
  id: string;
  main_canvas: OffscreenCanvas;
  width: number;
  height: number;
  main_ctx: WebGL2RenderingContext;
  priority: number;

  screenWidth;
  screenHeight;

  tool: string;
  lastPointer: Pointer;

  drawManager;

  constructor(
    id: string,
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    priority: number,
    screenWidth,
    screenHeight,
  ) {
    this.id = id;
    this.main_canvas = main_canvas;
    let gl = main_canvas.getContext("webgl2", {
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
      //premultipliedAlpha: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.main_ctx = gl;
    this.priority = priority;

    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.initSize(width, height);

    this.init();
  }

  async init() {
    this.drawInit();
    this.eraserInit();
    await this.liquifyInit();
  }

  clear() {
    let glHelper = getGlHelper(this.main_ctx);
    glHelper.clearRect(0, 0, this.width, this.height);
  }

  render(width, height, screenWidth, screenHeight, x, y, magnification) {
    renderScreen(
      this.main_canvas,
      this.main_ctx,
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

  initSize(width, height) {
    paintOptions.width = width;
    paintOptions.height = height;

    paintOptions.screenWidth = this.screenWidth;
    paintOptions.screenHeight = this.screenHeight;
    this.width = width;
    this.height = height;
    this.main_canvas.width = this.screenWidth;
    this.main_canvas.height = this.screenHeight;
  }

  setStrokeColor(r, g, b) {
    // paintOption.color = { r, g, b };
    paintOptions.setColor({ r, g, b });
  }

  setStrokeSize(strokeSize) {
    // paintOption.radius = strokeSize;
    paintOptions.setRadius(strokeSize);
  }

  setAlpha(alpha) {
    // paintOption.alpha = alpha;
    paintOptions.setAlpha(alpha);
  }

  drawInit() {
    this.drawManager = getBrushManager(this.main_canvas, this.main_ctx);
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
    this.drawManager.reset();
  }

  eraserInit() {
    this.drawManager = getBrushManager(this.main_canvas, this.main_ctx);
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

  liquifyManager;

  async liquifyInit() {
    this.liquifyManager = await getLiquifyManager(
      this.main_canvas,
      this.main_ctx,
    );
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

  liquifyReset() {
    console.log("리퀴파이 리셋!");
    this.liquifyManager.reset();
  }

  // appendHistory() {
  //   // 지금 상태를 히스토리에 넣기!

  //   let imageTexture = makeImageTex(this.main_canvas, this.main_ctx);
  //   history.push(imageTexture);
  // }
}
