import { getGlHelper } from "./glHelper";
import { getBrushManager } from "./tools";

interface Pointer {
  x: number;
  y: number;
}
const paintOption = {
  color: { r: 0, g: 0, b: 0 },
  radius: 1,
  alpha: 1,
};

export class PaintLayer {
  id: string;
  name: string;
  main_canvas: OffscreenCanvas;
  width: number;
  height: number;
  main_ctx: WebGL2RenderingContext;
  priority: number;
  dataBlob?: Blob;

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
    dataBlob?: Blob,
  ) {
    this.id = id;
    this.name = name;
    this.main_canvas = main_canvas;
    let gl = main_canvas.getContext("webgl2", {
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.main_ctx = gl;
    this.priority = priority;
    this.dataBlob = dataBlob;

    this.setSize(width, height);

    this.init();
  }

  async init() {
    if (this.dataBlob) {
      //const imageBitmap = await createImageBitmap(this.dataBlob);
      //this.main_ctx.drawImage(imageBitmap, 0, 0);
    } else {
      // this.main_ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  clear() {
    let glHelper = getGlHelper(this.main_ctx);
    glHelper.clearRect(0, 0, this.width, this.height);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.main_canvas.width = width;
    this.main_canvas.height = height;
  }

  setStrokeColor(r, g, b) {
    paintOption.color = { r, g, b };
  }

  setStrokeSize(strokeSize) {
    paintOption.radius = strokeSize;
  }

  setAlpha(alpha) {
    paintOption.alpha = alpha;
  }

  drawStart(pointer: Pointer) {
    this.drawManager = getBrushManager(
      this.main_canvas,
      this.main_ctx,
      this.width,
      this.height,
    );

    this.drawManager.reset();
    this.lastPointer = pointer;

    this.drawManager.setAlpha(paintOption.alpha);
    this.drawManager.setRadius(paintOption.radius);
    this.drawManager.setColor(paintOption.color);
  }

  drawTo(pointer: Pointer) {
    this.drawManager.stroke(this.lastPointer, pointer);
    this.drawManager.brush();
    this.lastPointer = pointer;
  }

  eraserStart(pointer: Pointer) {
    this.drawManager = getBrushManager(
      this.main_canvas,
      this.main_ctx,
      this.width,
      this.height,
    );

    this.drawManager.reset();
    this.lastPointer = pointer;

    this.drawManager.setAlpha(paintOption.alpha);
    this.drawManager.setRadius(paintOption.radius);
  }

  eraserTo(pointer: Pointer) {
    this.drawManager.stroke(this.lastPointer, pointer);
    this.drawManager.eraser();
    this.lastPointer = pointer;
  }
}
