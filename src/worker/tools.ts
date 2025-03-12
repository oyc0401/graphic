import { createShader, createProgram, getGlHelper } from "./glHelper";

const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, FBO 전용, 셰이더에서 접근 X!)
  SOURCE: 1, // 원본 이미지 (Source Image)
  PATHMAP: 2, // 브러시, 지우개 알파맵
  //EASE_INTEGRAL: 6, // Ease In-Out Cubic Integral
  //EASE_MIRROR: 7, // Ease In-Out Cubic Mirror
};

/**
 * 싱글톤, 처음 시작할 때만 glsl 컴파일 함.
 */
const drawManagers = new Map();

export function getBrushManager(canvas, gl, width, height) {
  if (drawManagers.has(gl)) {
    return drawManagers.get(gl);
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
    uniform sampler2D u_pathMap;

    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
    `;

  let strokeShaderSource = `#version 300 es
    precision highp float;
    
    uniform sampler2D u_pathMap;
    
    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_radius;
    uniform vec2 u_resolution;
    uniform float u_alpha;
    
    in vec2 v_texCoord;
    out float outAlpha;
    
    void main() {
      float basicAlpha = texture(u_pathMap, v_texCoord).x; // 원래 해당 좌표의 투명도
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
  let strokeShader = createShader(gl, gl.FRAGMENT_SHADER, strokeShaderSource);

  let strokeProgram = createProgram(gl, vertexShader, strokeShader);
  gl.useProgram(strokeProgram);

  gl.uniform2f(
    gl.getUniformLocation(strokeProgram, "u_resolution"),
    width,
    height,
  );

  const emptyData = new Float32Array(width * height);

  // 알파맵 텍스처 생성 및 데이터 업로드
  let pathTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
  gl.bindTexture(gl.TEXTURE_2D, pathTex);
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
    gl.getUniformLocation(strokeProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  // 출력용 텍스처 생성
  let pathTexOut = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, pathTexOut);
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
    pathTexOut,
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
    pathTexOut,
    0,
  );

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW,
  );
  let posLoc = gl.getAttribLocation(strokeProgram, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  //////////////////////////

  // 원본 이미지 텍스처 생성
  // (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
  let originalTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);

  gl.bindTexture(gl.TEXTURE_2D, originalTexture);

  // canvas를 webgl로 옮길 때 좌측하단이 0,0가 되므로, y축 반전을 해줘야함.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  //////////////////////////
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  let brushShaderSource = `#version 300 es
      precision highp float;
      
      uniform sampler2D u_pathMap;
      uniform sampler2D u_sourse;  // 원본 텍스처
      uniform vec2 u_resolution;
      uniform vec3 u_color; // 원하는 색

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색
        vec4 brushColor = vec4(u_color, value); // 새로운 색
    
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

  let brushShader = createShader(gl, gl.FRAGMENT_SHADER, brushShaderSource);
  let brushProgram = createProgram(gl, vertexShader, brushShader);
  gl.useProgram(brushProgram);
  gl.uniform2f(
    gl.getUniformLocation(brushProgram, "u_resolution"),
    width,
    height,
  );
  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  let posLoc2 = gl.getAttribLocation(brushProgram, "a_position");
  gl.enableVertexAttribArray(posLoc2);
  gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

  ///////////////////////////////////////
  let eraserShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_sourse;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색

        float newAlpha = imageColor.a - imageColor.a * value;
        outColor = vec4(imageColor.rgb * newAlpha , newAlpha);
      }
      `;

  let eraserShader = createShader(gl, gl.FRAGMENT_SHADER, eraserShaderSource);
  let eraserProgram = createProgram(gl, vertexShader, eraserShader);
  gl.useProgram(eraserProgram);
  gl.uniform2f(
    gl.getUniformLocation(eraserProgram, "u_resolution"),
    width,
    height,
  );
  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  let posLoc3 = gl.getAttribLocation(eraserProgram, "a_position");
  gl.enableVertexAttribArray(posLoc3);
  gl.vertexAttribPointer(posLoc3, 2, gl.FLOAT, false, 0, 0);

  //////////////////////////////

  let cancelShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_sourse;  // 원본 텍스처

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색
        
        outColor = vec4(imageColor.rgb * imageColor.a, imageColor.a);
      }
      `;

  let cancelShader = createShader(gl, gl.FRAGMENT_SHADER, cancelShaderSource);
  let cancelProgram = createProgram(gl, vertexShader, cancelShader);
  gl.useProgram(cancelProgram);
  gl.uniform2f(
    gl.getUniformLocation(cancelProgram, "u_resolution"),
    width,
    height,
  );

  gl.uniform1i(
    gl.getUniformLocation(cancelProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  );

  let posLoc4 = gl.getAttribLocation(cancelProgram, "a_position");
  gl.enableVertexAttribArray(posLoc4);
  gl.vertexAttribPointer(posLoc4, 2, gl.FLOAT, false, 0, 0);

  //////////////////////

  let color = [0, 0, 0];
  let radius = 1;
  let alpha = 0.5;
  let dirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

  let isDrawing = false;
  ///////////

  function stroke(start, end) {
    gl.useProgram(strokeProgram);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);

    // 유나폼 변수 설정
    gl.uniform1f(gl.getUniformLocation(strokeProgram, "u_radius"), radius);
    gl.uniform1f(gl.getUniformLocation(strokeProgram, "u_alpha"), alpha);

    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_start"),
      start.x,
      height - start.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_end"),
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
      pathTexOut,
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
      pathTexOut,
      0,
    );

    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      pathTex,
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

  function brush() {
    gl.useProgram(brushProgram);

    gl.uniform3fv(gl.getUniformLocation(brushProgram, "u_color"), color);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);
  }

  function eraser() {
    gl.useProgram(eraserProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);
  }

  function cancel() {
    gl.disable(gl.SCISSOR_TEST);

    gl.useProgram(cancelProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    

  
  }

  function reset() {
    let glHelper = getGlHelper(gl);
    glHelper.clearTexture(pathTex, width, height, 0);

    // 원본 이미지 텍스처 생성
    // (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);

    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    // canvas를 webgl로 옮길 때 좌측하단이 0,0가 되므로, y축 반전을 해줘야함.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, f);
  }

  function setAlpha(newAlpha) {
    alpha = newAlpha;
  }

  function setRadius(newRadius) {
    radius = newRadius;
  }

  function setColor({ r, g, b }) {
    color[0] = r / 255;
    color[1] = g / 255;
    color[2] = b / 255;
  }

  let brushManager = {
    stroke,
    brush,
    eraser,
    reset,
    setAlpha,
    setRadius,
    setColor,
    cancel,
  };
  drawManagers.set(gl, brushManager);

  return brushManager;
}
