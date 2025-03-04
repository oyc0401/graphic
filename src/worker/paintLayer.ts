import { PencilTool, BrushTool, PixelEraser, Tool } from "./tools";

export class PaintLayer {
  id: string;
  name: string;
  main_canvas: OffscreenCanvas;
  draw_canvas: OffscreenCanvas;
  width: number;
  height: number;
  main_ctx: OffscreenCanvasRenderingContext2D;
  draw_ctx: OffscreenCanvasRenderingContext2D;
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
    this.main_ctx = main_canvas.getContext("2d");
    this.draw_ctx = draw_canvas.getContext("2d");
    this.main_ctx.imageSmoothingEnabled = false;
    this.draw_ctx.imageSmoothingEnabled = false;
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
      this.main_ctx.drawImage(imageBitmap, 0, 0);
    } else if (this.background) {
      this.main_ctx.fillStyle = this.background;
      this.main_ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.main_ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  clear() {
    if (this.background) {
      this.main_ctx.fillStyle = this.background;
      this.main_ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.main_ctx.clearRect(0, 0, this.width, this.height);
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
    this.pushDrawPointer(pointer);
  }

  paint() {
    if (this.tool == "PENCIL") {
      this.tools[this.tool].paint(this.draw_ctx, this.draw_pointers);
    } else if (this.tool == "BRUSH") {
      // 해당 도구는 한번에 모든 선을 그리기때문에, 초기화 해줘야함.
      // 이거 나중에 그린 영역만 지우도록 만들어야함.
      this.draw_ctx.clearRect(0, 0, this.width, this.height);
      this.tools[this.tool].paint(this.draw_ctx, this.draw_pointers);
    }
  }

  pointerUp() {
    if (this.tool == "PENCIL") {
      this.main_ctx.drawImage(this.draw_canvas, 0, 0);
    } else if (this.tool == "BRUSH") {
      this.main_ctx.drawImage(this.draw_canvas, 0, 0);
      // paintBrush(this.main_ctx, this.draw_pointers);
    }

    this.draw_ctx.clearRect(0, 0, this.width, this.height);
    this.draw_pointers = [];
    this.tool == "no";
  }

  eraserStart(pointer, size, tool) {
    if (tool == "ERASER") {
      this.main_temp_canvas = new OffscreenCanvas(this.width, this.height);
      this.main_temp_ctx = this.main_temp_canvas.getContext("2d");
      this.main_temp_ctx.drawImage(this.main_canvas, 0, 0);
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
        this.main_ctx.clearRect(s.x, s.y, w, h);
        //this.draw_ctx.save();
        //this.draw_ctx.globalCompositeOperation = "copy";
        this.main_ctx.drawImage(
          this.main_temp_canvas,
          s.x,
          s.y,
          w,
          h,
          s.x,
          s.y,
          w,
          h,
        );
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

      this.main_ctx.save();
      this.main_ctx.globalCompositeOperation = "copy";
      this.main_ctx.drawImage(this.main_temp_canvas, 0, 0);
      this.main_ctx.restore();
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
