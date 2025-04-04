import { getGlHelper } from "./utils/glHelper";
import { BrushTool, EraserTool, installTools, LiquifyTool } from "./tool/tool";
import { paintOptions } from "./texture";
import { renderScreen } from "./render";
interface Pointer {
  x: number;
  y: number;
}

export class PaintAPI {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  dpr: number;

  toolId: string;
  tools: any;
  lastPointer: Pointer;

  constructor(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
  ) {
    this.canvas = canvas;
    let gl = canvas.getContext("webgl2", {
      alpha: false,
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
    paintOptions.dpr = dpr;

    this.toolId = "brush";

    this.init();
  }
  async init() {
    await this.installTools();
    console.log("Making Layer Complete!");
  }

  async installTools() {
    await installTools(this.canvas, this.gl);

    let brushTool = new BrushTool(this.canvas, this.gl);
    let eraserTool = new EraserTool(this.canvas, this.gl);
    let liquifyTool = new LiquifyTool(this.canvas, this.gl);

    this.tools = {
      brush: brushTool,
      eraser: eraserTool,
      liquify: liquifyTool,
    };
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
    paintOptions.setRadius(strokeSize / 2);
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
    return this.tools[this.toolId];
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

  makeSelection() {
    paintOptions.showSelection = true;
  }
  moveSelection() {
    // paint.moveSelection();
  }
  applySelection() {
     paintOptions.showSelection = false;
  }
}
