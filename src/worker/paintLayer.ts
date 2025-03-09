import { getGlHelper } from "./glHelper";
import { PencilTool, BrushTool, PixelEraser, Tool } from "./tools";
import { getBrushManager } from "./tools";
export class PaintLayer {
  id: string;
  name: string;
  main_canvas: OffscreenCanvas;
  draw_canvas: OffscreenCanvas;
  width: number;
  height: number;
  main_ctx: WebGL2RenderingContext;
  draw_ctx: WebGL2RenderingContext;
  priority: number;
  background?: string;
  dataBlob?: Blob;
  draw_pointers: { x; y; size; color }[];
  tool: string;
  tools: { [key: string]: Tool };
  brushColor: string;
  brushSize: number;

  start = { x: 0, y: 0 };
  end = { x: 0, y: 0 };
  maxSize = 0;

  main_temp_canvas: OffscreenCanvas;
  main_temp_ctx: OffscreenCanvasRenderingContext2D;

  lastPointer;

  drawManager;
  constructor(
    id: string,
    name: string,
    main_canvas: OffscreenCanvas,
    draw_canvas: OffscreenCanvas,
    width: number,
    height: number,
    priority: number,
    background?: string,
    dataBlob?: Blob,
  ) {
    this.id = id;
    this.name = name;
    this.main_canvas = main_canvas;
    this.draw_canvas = draw_canvas;
    this.main_ctx = main_canvas.getContext("webgl2", {
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.draw_ctx = draw_canvas.getContext("webgl2");
    //this.main_ctx.imageSmoothingEnabled = false;
    //this.draw_ctx.imageSmoothingEnabled = false;
    this.priority = priority;
    this.background = background;
    this.dataBlob = dataBlob;

    this.setSize(width, height);

    this.tools = {};
    this.tools["PENCIL"] = new PencilTool();
    this.tools["BRUSH"] = new BrushTool();
    this.tools["PIXEL_ERASER"] = new PixelEraser();
    this.draw_pointers = [];

    this.init();
  }

  async init() {
    if (this.dataBlob) {
      const imageBitmap = await createImageBitmap(this.dataBlob);
      //this.main_ctx.drawImage(imageBitmap, 0, 0);
    } else if (this.background) {
      //this.main_ctx.fillStyle = this.background;
      //this.main_ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // this.main_ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  clear() {
    if (this.background) {
      //this.main_ctx.fillStyle = this.background;
      //this.main_ctx.fillRect(0, 0, this.width, this.height);
    } else {
      //this.main_canvas.width = this.main_canvas.width
      let glHelper = getGlHelper(this.main_ctx);
      glHelper.clearRect(0, 0, this.width, this.height);
    }
    this.draw_pointers = [];
  }

  setSize(width, height) {
    const { main_canvas, draw_canvas } = this;

    this.width = width;
    this.height = height;
    main_canvas.width = width;
    main_canvas.height = height;
    draw_canvas.width = width;
    draw_canvas.height = height;
  }

  pushDrawPointer(pointer) {
    if (this.draw_pointers.length == 0) {
      this.start = { x: pointer.x, y: pointer.y };
      this.end = { x: pointer.x, y: pointer.y };
      this.maxSize = this.brushSize;
    }

    this.draw_pointers.push({
      x: pointer.x,
      y: pointer.y,
      color: this.brushColor,
      size: this.brushSize,
    });

    if (pointer.x < this.start.x) this.start.x = pointer.x;
    if (pointer.y < this.start.y) this.start.y = pointer.y;
    if (this.end.x < pointer.x) this.end.x = pointer.x;
    if (this.end.y < pointer.y) this.end.y = pointer.y;
    if (this.maxSize < this.brushSize) this.maxSize = this.brushSize;
  }

  setBrushColor(color) {
    this.brushColor = color;
  }
  setBrushSize(size) {
    this.brushSize = size;
  }

  drawStart(pointer, tool) {
    this.tool = tool;
    this.draw_pointers = [];
    this.lastPointer = pointer;
    //this.pushDrawPointer(pointer);

    // 먼저, 지금 텍스쳐는 한곳에 저장해두고.
    // 드로우 배열을 초기화 시킨다. 드로우 배열은 해당 좌표에 얼마나 그려졌는지 표시하는 배열이다.
    // 드로우배열이 1이면 투명도가 1이다.
    // 만약 색이 투명도가 처음부터 낮은 색이라면, 그 투명도가 저장되고
    // 펜압 또는 경계보간으로 인해 낮은 투명도 위에 더높은 투명도가 덮어씌워지면 높은 투명도를 반영한다.
    // 그럼 처음부터 rgb와 알파값은 따로 4군데로 보관해야겠다.
    // ctx.clearDrawMap();

    this.drawManager = getBrushManager(
      this.main_canvas,
      this.main_ctx,
      this.width,
      this.height,
    );

    this.drawManager.reset();
  }

  draw(pointer) {
    if (this.tool == "PENCIL") {
      this.tools[this.tool].paint(this.draw_ctx, this.draw_pointers);
    } else if (this.tool == "BRUSH") {
      this.drawManager.draw(this.lastPointer, pointer);
      this.drawManager.render();
      this.lastPointer = pointer;
      // ctx.drawBrush(lastX, lastY, x, y);
      // ctx.renderBrush(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    }
  }

  drawEnd() {
    if (this.tool == "PENCIL") {
      //this.main_ctx.drawImage(this.draw_canvas, 0, 0);
    } else if (this.tool == "BRUSH") {
      //this.main_ctx.drawImage(this.draw_canvas, 0, 0);
      // paintBrush(this.main_ctx, this.draw_pointers);
    }

    this.draw_pointers = [];
    this.tool == "no";
  }

  eraserStart(pointer, size, tool) {
    if (tool == "ERASER") {
      //this.main_temp_canvas = new OffscreenCanvas(this.width, this.height);
      //this.main_temp_ctx = this.main_temp_canvas.getContext("2d");
      //this.main_temp_ctx.drawImage(this.main_canvas, 0, 0);
    } else if (tool == "PIXEL_ERASER") {
    }

    this.tool = tool;
    this.draw_pointers = [];
    this.pushDrawPointer(pointer);
  }

  eraser() {
    if (this.tool == "ERASER") {
      let size = this.maxSize;
      let s = {
        x: Math.floor(this.start.x - size),
        y: Math.floor(this.start.y - size),
      };
      let end = {
        x: Math.ceil(this.end.x + size),
        y: Math.ceil(this.end.y + size),
      };
      let w = end.x - s.x;
      let h = end.y - s.y;

      // 적은 영역일때는 중복되어 지워지는게 티가 많이 남
      // 많이지울때는 그냥 티가 별로 안난다고 믿자.

      if (w * h < 600 * 600) {
        //this.main_ctx.clearRect(s.x, s.y, w, h);
        //this.draw_ctx.save();
        //this.draw_ctx.globalCompositeOperation = "copy";
        // this.main_ctx.drawImage(
        //   this.main_temp_canvas,
        //   s.x,
        //   s.y,
        //   w,
        //   h,
        //   s.x,
        //   s.y,
        //   w,
        //   h,
        // );
        //this.draw_ctx.restore();

        // 범위 테스트용
        // this.draw_ctx.fillStyle = "rgba(255,0,0,0.1)";
        // this.draw_ctx.fillRect(s.x, s.y, w, h);
        eraser(this.main_ctx, this.draw_pointers);
      } else {
        eraser(this.main_ctx, this.draw_pointers);
      }
    } else if (this.tool == "PIXEL_ERASER") {
      this.tools[this.tool].paint(this.main_ctx, this.draw_pointers);
    }
  }

  eraserUp() {
    if (this.tool == "ERASER") {
      eraser(this.main_temp_ctx, this.draw_pointers);

      // this.main_ctx.save();
      // this.main_ctx.globalCompositeOperation = "copy";
      // this.main_ctx.drawImage(this.main_temp_canvas, 0, 0);
      // this.main_ctx.restore();
      // this.main_temp_ctx.reset();
      // this.main_temp_canvas.메모리제거();
    } else {
      //
    }

    this.draw_pointers = [];
  }
}

function eraser(ctx, draw_pointers) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "red";
  ctx.beginPath();

  for (let i = 0; i < draw_pointers.length; i++) {
    let draw_pointer = draw_pointers[i];
    let { x, y, size } = draw_pointer;
    ctx.lineWidth = size;
    if (i == 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}
