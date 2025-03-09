//import { stamp_brush_canvas } from "../src/image-mani";
import { bresenham_dense_line, bresenham_line } from "./imageHelper";
import { createShader, createProgram, getGlHelper } from "./glHelper";

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
  if (brushManager) {
    return brushManager;
  }

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

  let brushShaderSource = `#version 300 es
    precision highp float;
    
    uniform sampler2D u_alphaMap;
    
    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_radius;
    uniform vec2 u_resolution;
    uniform float u_alpha;
    
    in vec2 v_texCoord;
    out float outAlpha;
    
    void main() {
      float basicAlpha = texture(u_alphaMap, v_texCoord).x; // 원래 해당 좌표의 투명도
      vec2 pixelCoord = v_texCoord * u_resolution; // 텍스쳐 좌표를 픽셀 단위로 변환
    
      vec2 ab = u_end - u_start;
      float t = clamp(dot(pixelCoord - u_start, ab) / dot(ab, ab), 0.0, 1.0);
      vec2 closestPoint = u_start + ab * t;
      float dist = length(pixelCoord - closestPoint);
    
      float newAlpha = u_alpha;
      if (dist < u_radius) {
        // 테두리 보간
        if (u_radius - dist < 1.0) {
          newAlpha = (u_radius - dist) * u_alpha;
         
          // 이렇게 하면 도트 그리기
          // newAlpha = (u_radius - dist) < 0.5 ? 0.0 : u_alpha;
        }
      } else {
        newAlpha = 0.0;
      }
    
      // 더 투명도가 높은 것 선택.
      if (basicAlpha < newAlpha) {
        outAlpha = newAlpha;
      } else {
        outAlpha = basicAlpha;
      }
    }
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
    gl.R32F,
    width,
    height,
    0,
    gl.RED,
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

  // 출력용 텍스처 생성
  let alphaTexOut = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, alphaTexOut);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    width,
    height,
    0,
    gl.RED,
    gl.FLOAT,
    null,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 프레임버퍼 생성 및 바인딩
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    alphaTexOut,
    0,
  );

  // 쓰여진 결과를 blit으로 기본 변위맵에 업로드 하기 위해서
  let readFrameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
  gl.framebufferTexture2D(
    // 당장 안쓰더라도 바인딩 해놓으면 내부에서 자체 최적화 되나?
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    alphaTexOut,
    0,
  );

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW,
  );
  let posLoc = gl.getAttribLocation(brushProgram, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  let renderShaderSource = `#version 300 es
      precision highp float;
      
      uniform sampler2D u_alphaMap;
      uniform sampler2D u_sourse;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_alphaMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색
        vec4 brushColor = vec4(1.0, 0.0, 0.0, value); // 새로운 색 (빨강 + 투명도)
    
        // Premultiplied Alpha 적용
        vec3 premultBrush = brushColor.rgb * brushColor.a; // RGB에 알파를 미리 곱함
        vec3 premultImage = imageColor.rgb * imageColor.a;
    
        // 블렌딩 (Premultiplied 방식)
        vec3 blendedRGB = premultImage * (1.0 - brushColor.a) + premultBrush;
        float blendedAlpha = imageColor.a + brushColor.a * (1.0 - imageColor.a); 
    
        // 최종 색상
        outColor = vec4(blendedRGB, blendedAlpha);
      }
      `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderShaderSource);
  let renderProgram = createProgram(gl, vertexShader, renderShader);
  gl.useProgram(renderProgram);
  gl.uniform2f(
    gl.getUniformLocation(renderProgram, "u_resolution"),
    width,
    height,
  );
  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_alphaMap"),
    TEXTURE_UNIT.ALPHAMAP,
  );

  // 원본 이미지 텍스처 생성
  // (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
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

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  let posLoc2 = gl.getAttribLocation(renderProgram, "a_position");
  gl.enableVertexAttribArray(posLoc2);
  gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

  ///////////////////////////////////////

  let radius = 5;
  let alpha = 0.3;
  //let strength = 1;
  let dirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

  function draw(start, end) {
    gl.useProgram(brushProgram);
    // 유나폼 변수 설정
    gl.uniform1f(gl.getUniformLocation(brushProgram, "u_radius"), radius);
    gl.uniform1f(gl.getUniformLocation(brushProgram, "u_alpha"), alpha);

    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_start"),
      start.x,
      height - start.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_end"),
      end.x,
      height - end.y,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // 프레임버퍼에 쓰기 텍스처 넣기
    // 이전에 blit할때 다른거 지정되어있었음
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      alphaTexOut,
      0,
    );

    let ceiledRadius = Math.ceil(radius);
    let minX = Math.min(start.x, end.x);
    let maxX = Math.max(start.x, end.x);
    let minY = Math.min(height - start.y, height - end.y);
    let maxY = Math.max(height - start.y, height - end.y);

    dirtyRect.x = minX - ceiledRadius;
    dirtyRect.y = minY - ceiledRadius;
    dirtyRect.ex = maxX + ceiledRadius + 1;
    dirtyRect.ey = maxY + ceiledRadius + 1;
    dirtyRect.width = maxX - minX + 1 + 2 * ceiledRadius;
    dirtyRect.height = maxY - minY + 1 + 2 * ceiledRadius;

    // SCISSOR TEST로 일부만 렌더링
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //gl.finish();

    // 적용된 텍스처를 read에도 옮기기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      alphaTexOut,
      0,
    );

    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      alphaTex,
      0,
    );

    gl.blitFramebuffer(
      dirtyRect.x,
      dirtyRect.y,
      dirtyRect.ex,
      dirtyRect.ey, // 소스
      dirtyRect.x,
      dirtyRect.y,
      dirtyRect.ex,
      dirtyRect.ey, // 대상
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function render() {
    gl.useProgram(renderProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);
  }

  function reset() {
    let glHelper = getGlHelper(gl);
    glHelper.clearTexture(alphaTex, width, height, 0);

    // 원본 이미지 텍스처 생성
    // (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);

    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    // canvas를 webgl로 옮길 때 좌측하단이 0,0가 되므로, y축 반전을 해줘야함.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  brushManager = {
    render,
    draw,
    reset,
  };

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
