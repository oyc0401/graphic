import { getGlHelper } from "./glHelper";
import { BrushTool, EraserTool, LiquifyTool } from "./tool/tool";
import { paintOptions } from "./texture";
import { renderScreen } from "./render";
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

  toolId: string;
  tool: any;
  lastPointer: Pointer;

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

    this.toolInit();
  }

  async toolInit() {
    let brushTool = new BrushTool();
    let eraserTool = new EraserTool();
    let liquifyTool = new LiquifyTool();

    await brushTool.init(this.canvas, this.gl);
    await eraserTool.init(this.canvas, this.gl);
    await liquifyTool.init(this.canvas, this.gl);

    this.tool = {
      brush: brushTool,
      eraser: eraserTool,
      liquify: liquifyTool,
    };

    this.toolId = "brush";
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

    // this.drawManager.setSize();
    //this.liquifyManager.setSize();
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
  setTool(toolId) {
    if (this.toolId != toolId) {
      this.getTool().exit();
    }
    this.toolId = toolId;
    this.getTool().enter();
  }
  getTool() {
    return this.tool[this.toolId];
  }
  start(pointer: Pointer) {
    this.getTool().start(pointer);
    this.lastPointer = pointer;
  }
  strokeTo(pointer: Pointer) {
    this.getTool().stroke(this.lastPointer, pointer);
    this.lastPointer = pointer;
  }
  end() {
    this.getTool().end();
  }
  cancel() {
    this.getTool().cancel();
  }
}
