import { getGlHelper } from "./glHelper";
import { getLiquifyManager } from "./liquify/liquify";
import { getBrushManager, paintOptions, resizeScreen } from "./tools";

interface Pointer {
  x: number;
  y: number;
}

let history = [];

// export let position = {
//   x: 50,
//   y: 50,
//   width: 500,
//   height: 500,
//   scale: 1,
//   resizeScreen() {},
// };

export class PaintLayer {
  id: string;
  name: string;
  main_canvas: OffscreenCanvas;
  width: number;
  height: number;
  main_ctx: WebGL2RenderingContext;
  priority: number;
  // dataBlob?: Blob;
  canvasWidth;
  canvasHeight;

  tool: string;
  lastPointer: Pointer;

  drawManager;

  constructor(
    id: string,
    name: string,
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    priority: number,
    canvasWidth,
    canvasHeight,
  ) {
    this.id = id;
    this.name = name;
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

    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.main_canvas.width = canvasWidth;
    this.main_canvas.height = canvasHeight;

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

  setSize(width, height) {
    this.width = width;
    this.height = height;
    paintOptions.width = width;
    paintOptions.height = height;

    //resizeScreen(this.main_canvas, this.main_ctx, width, height);

    this.drawManager.setSize();
    this.liquifyManager.setSize();
  }

  initSize(width, height) {
    paintOptions.width = this.canvasWidth;
    paintOptions.height = this.canvasHeight;

    this.width = width;
    this.height = height;
    this.main_canvas.width = this.canvasWidth;
    this.main_canvas.height = this.canvasHeight;
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
