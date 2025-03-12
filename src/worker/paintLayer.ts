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

let history = [];

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
      //premultipliedAlpha: true,
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
    console.log('reseted')

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

  cancel(){
    this.drawManager.cancel();
  }

  appendHistory() {
    // 지금 상태를 히스토리에 넣기!

    let imageTexture = makeImageTex(this.main_canvas, this.main_ctx);
    history.push(imageTexture);
  }
}
const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, FBO 전용, 셰이더에서 접근 X!)
  SOURCE: 1, // 원본 이미지 (Source Image)
  PATHMAP: 2, // 브러시, 지우개 알파맵
  //EASE_INTEGRAL: 6, // Ease In-Out Cubic Integral
  //EASE_MIRROR: 7, // Ease In-Out Cubic Mirror
};

function makeImageTex(canvas, gl) {
  let originalTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);

  gl.bindTexture(gl.TEXTURE_2D, originalTexture);

  // canvas를 webgl로 옮길 때 좌측하단이 0,0가 되므로, y축 반전을 해줘야함.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return originalTexture;
}
