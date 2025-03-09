//import { stamp_brush_canvas } from "../src/image-mani";
import { bresenham_dense_line, bresenham_line } from "./imageHelper";
import { createShader, createProgram } from "./glHelper";

const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, FBO 전용, 셰이더에서 접근 X!)
  SOURCE: 1, // 원본 이미지 (Source Image)
  ALPHAMAP: 2, // 브러시 알파맵
  //EASE_INTEGRAL: 6, // Ease In-Out Cubic Integral
  //EASE_MIRROR: 7, // Ease In-Out Cubic Mirror
};

/**
 * 싱글톤, 처음 시작할 때만 glsl 컴파일 함.
 */
let brushManager;
export function getBrushManager(canvas, gl, width, height) {
  if (!brushManager) {
    let alphaMap = [[]];

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.error("EXT_color_buffer_float not supported!");
    }
    const extFloatLinear =
      gl.getExtension("OES_texture_float_linear") ||
      gl.getExtension("EXT_texture_filter_float");
    if (!extFloatLinear) {
      console.error(
        "This device does not support linear filtering for float textures.",
      );
    }

    let vertexShaderSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord; // 좌표변환: 0 ~ 1

    uniform vec2 u_resolution;
    uniform sampler2D u_alphaMap;

    void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
    `;

    let brushShaderSource = `
    `;
    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    let brushShader = createShader(gl, gl.FRAGMENT_SHADER, brushShaderSource);

    let brushProgram = createProgram(gl, vertexShader, brushShader);
    gl.useProgram(brushProgram);

    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_resolution"),
      width,
      height,
    );

    const emptyData = new Float32Array(width * height);

    // 알파맵 텍스처 생성 및 데이터 업로드
    let alphaTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.ALPHAMAP);
    gl.bindTexture(gl.TEXTURE_2D, alphaTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      width,
      height,
      0,
      gl.RG,
      gl.FLOAT,
      emptyData,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(brushProgram, "u_alphaMap"),
        TEXTURE_UNIT.ALPHAMAP,
    );

    // 알파맵 텍스쳐 만들고
    // 버텍스 셰이더 코드 적고 (풀 스크린)
    // 프래그먼트 셰이더 적고
    // 텍스처 바인딩 하고
    // 기존 이미지 텍스쳐 업로드 하고
    // draw()함수 내부에서 rgba, 사이즈 유니폼 업데이트하고, 시저테스트로 구역 정하고 알파맵 변환 시키고
    // render() 함수에선 알파맵과 rgb를 기준으로 이미지에 렌더링하고

    brushManager = {};
  }

  return brushManager;
}

export class Tool {
  paint(ctx, draw_pointers) {}
}

export class PencilTool extends Tool {
  mask_canvas; // 매번 초기화 되는 임시 캔버스
  mask_ctx;
  lastIndex = 0; // 해당 도구는 한번에 모든선을 그리지 않고, 앞으로 그릴 영역의 그림만 그리기 때문에 마지막 포인터 인덱스가 필요하다.

  paint(ctx, draw_pointers) {
    for (let i = this.lastIndex; i < draw_pointers.length; i++) {
      let draw_pointer = draw_pointers[i];

      // 연필은 정수 픽셀만
      let x = ~~draw_pointer.x;
      let y = ~~draw_pointer.y;
      let { color, size } = draw_pointer;

      if (i != 0) {
        let prev_x = ~~draw_pointers[i - 1].x;
        let prev_y = ~~draw_pointers[i - 1].y;

        // 0. 시작점과 끝점 기준으로 임시 캔버스 생성
        const startX = Math.min(prev_x, x);
        const startY = Math.min(prev_y, y);
        const endX = Math.max(prev_x, x);
        const endY = Math.max(prev_y, y);
        const width = endX - startX + size * 2;
        const height = endY - startY + size * 2;

        // 마스크 캔버스 초기화
        if (!this.mask_canvas) {
          this.mask_canvas = new OffscreenCanvas(width, height);
          this.mask_ctx = this.mask_canvas.getContext("2d");
        }
        this.mask_canvas.width = width;
        this.mask_canvas.height = height;
        this.mask_ctx.imageSmoothingEnabled = false;

        // ctx.fillStyle = "rgba(255,0,0,0.1)";
        // ctx.fillRect(startX, startY, width, height);

        // 1. 임시 캔버스에 도형 그리기
        this.mask_ctx.fillStyle = "red";
        this.mask_ctx.globalCompositeOperation = "source-over";
        const iterate_line = size > 1 ? bresenham_dense_line : bresenham_line;
        iterate_line(
          prev_x - startX,
          prev_y - startY,
          x - startX,
          y - startY,
          (dx, dy) => {
            //this.mask_ctx.fillRect(dx, dy, size, size);
            // stamp_brush_canvas(
            //   this.mask_ctx,
            //   dx + size,
            //   dy + size,
            //   "circle",
            //   size,
            // );
          },
        );

        // 2. draw_canvas에서 this.mask_canvas가 차지하는 영역 지우기
        // 이 작업을 왜하냐면 투명도 50인 색을 칠할때 지우지 않으면 겹쳐보임
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(this.mask_canvas, startX - size, startY - size);
        ctx.restore();

        // 3. this.mask_canvas의 투명하지 않은 색을 원하는 색으로 바꾸기
        // 이렇게 하는 이유는 지우기를 할 땐 투명도가 0이여야하고 그리기를 할떈 투명도가 있어도 되기 때문
        this.mask_ctx.globalCompositeOperation = "source-in";
        this.mask_ctx.fillStyle = color;
        this.mask_ctx.fillRect(
          0,
          0,
          this.mask_canvas.width,
          this.mask_canvas.height,
        );

        // 4. draw_canvas에 this.mask_canvas 그리기
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(this.mask_canvas, startX - size, startY - size);
      }
    }

    this.lastIndex = draw_pointers.length - 1;
  }
}

export class BrushTool extends Tool {
  paint(ctx, draw_pointers) {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < draw_pointers.length; i++) {
      let draw_pointer = draw_pointers[i];
      let { x, y, color, size } = draw_pointer;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      if (i == 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

export class PixelEraser extends Tool {
  lastIndex = 0; // 해당 도구는 한번에 모든선을 그리지 않고, 앞으로 그릴 영역의 그림만 그리기 때문에 마지막 포인터 인덱스가 필요하다.

  paint(ctx, draw_pointers) {
    for (let i = this.lastIndex; i < draw_pointers.length; i++) {
      let draw_pointer = draw_pointers[i];

      // 연필은 정수 픽셀만
      let x = ~~draw_pointer.x;
      let y = ~~draw_pointer.y;
      let { size } = draw_pointer;

      if (i != 0) {
        let prev_x = ~~draw_pointers[i - 1].x;
        let prev_y = ~~draw_pointers[i - 1].y;

        const iterate_line = size > 1 ? bresenham_dense_line : bresenham_line;
        iterate_line(prev_x, prev_y, x, y, (dx, dy) => {
          ctx.clearRect(
            Math.ceil(dx - size / 2),
            Math.ceil(dy - size / 2),
            size,
            size,
          );
        });
      }
    }

    this.lastIndex = draw_pointers.length - 1;
  }
}
