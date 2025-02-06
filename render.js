// 전역:
let gl;
let width, height;
let warpProgram, warpVAO;

// 원본 이미지 텍스처 + 사이즈
let texOriginal;
let imageWidth = 0;
let imageHeight = 0;

// 변위 맵 텍스처
let texDisplace;

// ========== 1. WebGL + 셰이더 초기화 ==========
function initWebGLRender(canvas) {
  // canvas로부터 WebGL2 context 생성
  gl = canvas.getContext("webgl2", { antialias: false });
  if (!gl) {
    throw new Error("WebGL2 not supported!");
  }

  width = canvas.width;
  height= canvas.height;

  // 셰이더 준비
  initWarpShader();
  // 풀스크린 사각형 VAO 준비
  initWarpVAO();
}

// 셰이더(프로그램) 생성
function initWarpShader() {
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos * 0.5) + 0.5; // [-1..1] -> [0..1]
    gl_Position = vec4(aPos, 0, 1);
  }`;

  const fsSource = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  out vec4 outColor;

  uniform sampler2D uOriginal;   // 원본 이미지
  uniform sampler2D uDisplace;   // 변위 맵 (RG)
  uniform vec2 uResolution;      // 캔버스 크기
  uniform vec4 uSubRegion;       // (sx, sy, ex, ey)
  uniform vec2 uImageSize;       // 원본 이미지 크기

  // CPU 코드의 bilinear 보간 함수
  vec4 sampleBilinear(sampler2D tex, float fx, float fy, vec2 imgSize) {
      float floorX = floor(fx);
      float floorY = floor(fy);
      float ceilX  = ceil(fx);
      float ceilY  = ceil(fy);
      float tx = fx - floorX;
      float ty = fy - floorY;

      vec2 uvF = vec2(floorX, floorY) / imgSize;
      vec2 uvC = vec2(ceilX,  ceilY)  / imgSize;

      vec4 c00 = texture(tex, vec2(uvF.x, uvF.y));
      vec4 c10 = texture(tex, vec2(uvC.x, uvF.y));
      vec4 c01 = texture(tex, vec2(uvF.x, uvC.y));
      vec4 c11 = texture(tex, vec2(uvC.x, uvC.y));

      vec4 cx0 = mix(c00, c10, tx);
      vec4 cx1 = mix(c01, c11, tx);
      return mix(cx0, cx1, ty);
  }

  void main(){
      // 현재 픽셀 좌표
      vec2 fragCoord = vec2(gl_FragCoord.x, gl_FragCoord.y);

      // 부분 영역
      float sx = uSubRegion.x;
      float sy = uSubRegion.y;
      float ex = uSubRegion.z;
      float ey = uSubRegion.w;

      // 영역 밖이면 투명
      if (fragCoord.x < sx || fragCoord.x >= ex ||
          fragCoord.y < sy || fragCoord.y >= ey) {
          outColor = vec4(0.0, 0.0, 0.0, 0.0);
          return;
      }

      // displace 읽기
      vec2 disp = texture(uDisplace, fragCoord / uResolution).rg;
      float newX = fragCoord.x + disp.x;
      float newY = fragCoord.y + disp.y;

      // bilinear 보간 (원본 이미지)
      vec4 color = sampleBilinear(uOriginal, newX, newY, uImageSize);

      outColor = color;
  }`;

  warpProgram = compileShaderProgram(vsSource, fsSource);
}

function initWarpVAO() {
  warpVAO = gl.createVertexArray();
  gl.bindVertexArray(warpVAO);

  const quad = new Float32Array([
    -1, -1,  // 좌하
     1, -1,  // 우하
    -1,  1,  // 좌상
     1,  1   // 우상
  ]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}

// 셰이더 프로그램 링크
function compileShaderProgram(vsSource, fsSource) {
  function compileShader(src, type) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(
        `Shader compile error (${
          type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT"
        }):\n` + gl.getShaderInfoLog(shader)
      );
    }
    return shader;
  }

  let vs = compileShader(vsSource, gl.VERTEX_SHADER);
  let fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
  let program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      "Shader program link error:\n" + gl.getProgramInfoLog(program)
    );
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

// ========== 2. 텍스처 생성 & 업로드 ==========

// 원본 이미지 텍스처
function initOriginalTexture(image) {
  texOriginal = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texOriginal);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA,
    image.width, image.height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, image
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);

  // imageWidth, imageHeight 설정
  imageWidth = image.width;
  imageHeight= image.height;
}

// displace 텍스처 (RG float)
function initDisplacementTexture() {
  texDisplace = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texDisplace);
  // RG32F => float 2채널
  gl.texImage2D(
    gl.TEXTURE_2D, 0,
    gl.RG32F, width, height, 0,
    gl.RG, gl.FLOAT, null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

// CPU의 displaceX, displaceY -> texDisplace 업로드
function uploadDisplaceToTex(displaceX, displaceY) {
  let size = width * height * 2;
  let buf = new Float32Array(size);
  for (let i=0; i<width*height; i++){
    buf[i*2 + 0] = displaceX[i];
    buf[i*2 + 1] = displaceY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, texDisplace);
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0,
    0,0, width, height,
    gl.RG, gl.FLOAT, buf
  );
  gl.bindTexture(gl.TEXTURE_2D,null);
}

// ========== 3. 부분 영역을 GPU로 렌더 (renderToImageGPU) ==========
function renderToImageGPU(sx, sy, ex, ey) {
  // 1) 셰이더 프로그램 & VAO 활성화
  gl.useProgram(warpProgram);
  gl.bindVertexArray(warpVAO);

  // 2) 원본 이미지 텍스처
  let loc = gl.getUniformLocation(warpProgram, "uOriginal");
  gl.uniform1i(loc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texOriginal);

  // 3) 변위 맵 텍스처
  loc = gl.getUniformLocation(warpProgram, "uDisplace");
  gl.uniform1i(loc, 1);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texDisplace);

  // 4) uResolution (전체 캔버스 크기)
  loc = gl.getUniformLocation(warpProgram, "uResolution");
  gl.uniform2f(loc, width, height);

  // 5) uSubRegion (sx, sy, ex, ey)
  loc = gl.getUniformLocation(warpProgram, "uSubRegion");
  gl.uniform4f(loc, sx, sy, ex, ey);

  // 6) uImageSize (원본이미지 실제 크기)
  loc = gl.getUniformLocation(warpProgram, "uImageSize");
  gl.uniform2f(loc, imageWidth, imageHeight);

  // 7) 부분만 업데이트하기 위해 scissor
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(sx, sy, ex - sx, ey - sy);

  // 8) 드로우 (풀스크린 사각형)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // 9) 정리
  gl.disable(gl.SCISSOR_TEST);
  gl.bindVertexArray(null);
  gl.useProgram(null);
}

// ========== 4. 사용 예시 ==========
// 1) initWebGLRender(canvas); // canvas.width/height 설정
// 2) initOriginalTexture(image);  // 이미지 로드 후
// 3) initDisplacementTexture();   // texDisplace 준비
// 4) uploadDisplaceToTex(displaceX, displaceY); // CPU 배열 -> GPU
// 5) renderToImageGPU(sx, sy, ex, ey); // 부분영역 GPU 변형
