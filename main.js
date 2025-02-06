/************************************************
 * 전역 설정 및 초기화
 ************************************************/
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 50;
const MAGNIFY_STRENGTH = 1;

let displaceX, displaceY;
let originalImageData, originalData;

// 브라우저 로드 시 이미지 불러오기 & 초기화
window.onload = async () => {
  try {
    // 원하는 이미지로 교체
    //const img = await loadImageFromURL("check.png");
    const img = await loadImageFromURL("cat.webp");
    drawImageToCanvas(img);

    initPixelFlow(canvas, ctx);

    // WebGL2용 OffscreenCanvas
    webglCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    width = canvas.width;
    height = canvas.height;

    await initWebGL2(webglCanvas);

    //initWebGLRender(canvas);
    // initOriginalTexture(img)
    //initDisplacementTexture();
  } catch (e) {
    console.error("이미지 로드 실패:", e);
  }
};

/************************************************
 * CPU 코드: 이미지, 캔버스
 ************************************************/
function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function drawImageToCanvas(img) {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
}
function initPixelFlow(canvas, ctx) {
  const w = canvas.width;
  const h = canvas.height;
  originalImageData = ctx.getImageData(0, 0, w, h);
  originalData = originalImageData.data;

  displaceX = new Float32Array(w * h);
  displaceY = new Float32Array(w * h);
}

// CPU에서 결과를 부분적으로 다시 그리는 예시
function renderToImage(canvas, sx, sy, ex, ey) {
  const cw = canvas.width;
  const ch = canvas.height;
  const w = ex - sx,
    h = ey - sy;
  console.log("render:", sx, sy, w, h);
  if (w <= 0 || h <= 0) return;

  const newImageData = new Uint8ClampedArray(w * h * 4);
  let iOut = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = y * cw + x;
      let dx = displaceX[idx];
      let dy = displaceY[idx];
      let newX = x + dx,
        newY = y + dy;

      // bilinear 보간
      const floorX = Math.floor(newX),
        floorY = Math.floor(newY);
      const ceilX = Math.ceil(newX),
        ceilY = Math.ceil(newY);
      const tx = newX - floorX,
        ty = newY - floorY;

      const getColor = (xx, yy) => {
        const cx = Math.min(Math.max(xx, 0), cw - 1);
        const cy = Math.min(Math.max(yy, 0), ch - 1);
        const base = (cy * cw + cx) * 4;
        return [
          originalData[base + 0],
          originalData[base + 1],
          originalData[base + 2],
          originalData[base + 3],
        ];
      };
      const c00 = getColor(floorX, floorY);
      const c10 = getColor(ceilX, floorY);
      const c01 = getColor(floorX, ceilY);
      const c11 = getColor(ceilX, ceilY);

      const interpolate = (c1, c2, c3, c4, tx, ty) => [
        (c1[0] * (1 - tx) + c2[0] * tx) * (1 - ty) +
          (c3[0] * (1 - tx) + c4[0] * tx) * ty,
        (c1[1] * (1 - tx) + c2[1] * tx) * (1 - ty) +
          (c3[1] * (1 - tx) + c4[1] * tx) * ty,
        (c1[2] * (1 - tx) + c2[2] * tx) * (1 - ty) +
          (c3[2] * (1 - tx) + c4[2] * tx) * ty,
        (c1[3] * (1 - tx) + c2[3] * tx) * (1 - ty) +
          (c3[3] * (1 - tx) + c4[3] * tx) * ty,
      ];
      const [r, g, b, a] = interpolate(c00, c10, c01, c11, tx, ty);
      const outIndex = iOut * 4;
      newImageData[outIndex + 0] = r;
      newImageData[outIndex + 1] = g;
      newImageData[outIndex + 2] = b;
      newImageData[outIndex + 3] = a;
      iOut++;
    }
  }
  let imgData = new ImageData(newImageData, w, h);
  ctx.putImageData(imgData, sx, sy);
}
// ================== 브레젠험 ==================
function getLinePoints(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0),
    dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return pts;
}

/************************************************
 * Bresenham + 마우스 이벤트
 ************************************************/
let positions = [];
let isTracking = false;
document.addEventListener("pointerdown", (evt) => {
  isTracking = true;
  positions = [];
  uploadDisplaceToTex(displaceX, displaceY, texA);
});
document.addEventListener("pointermove", (evt) => {
  if (!isTracking) return;
  let x = Math.floor(evt.clientX),
    y = Math.floor(evt.clientY);
  positions.push({ x, y });
  if (positions.length < 2) return;

  // 마지막 두 점으로 linePoints
  let n = positions.length;
  let start = positions[n - 2],
    end = positions[n - 1];
  let linePts = getLinePoints(start.x, start.y, end.x, end.y);

  // Ping-Pong GPU 순차 업데이트
  gpuApplyPixelFlowLinePoints(linePts);

  // bounding
  let minx = Math.min(start.x, end.x) - EFFECT_RADIUS;
  let miny = Math.min(start.y, end.y) - EFFECT_RADIUS;
  let maxx = Math.max(start.x, end.x) + EFFECT_RADIUS;
  let maxy = Math.max(start.y, end.y) + EFFECT_RADIUS;
  minx = Math.max(0, Math.floor(minx));
  miny = Math.max(0, Math.floor(miny));
  maxx = Math.min(canvas.width - 1, Math.ceil(maxx));
  maxy = Math.min(canvas.height - 1, Math.ceil(maxy));

  regionX = minx;
  regionY = miny;
  regionW = maxx - minx;
  regionH = maxy - miny;
  downloadTexToDisplace2(texA, fboA, displaceX, displaceY);
  // //console.log( minx, miny, maxx, maxy)
  renderToImage(canvas, minx, miny, maxx, maxy);
});
document.addEventListener("pointerup", (evt) => {
  isTracking = false;
  // downloadTexToDisplace(texA, fboA, displaceX, displaceY);
  // renderToImage(canvas, 0, 0, canvas.width, canvas.height);
});

let regionX = 10,
  regionY = 10; // 읽을 영역의 시작점
let regionW = 30,
  regionH = 30; // 읽을 영역의 크기

function downloadTexToDisplace2(tex, fbo, outX, outY) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // 가져올 데이터 버퍼 (2채널 RG)
  let buf = new Float32Array(regionW * regionH * 2);
  console.log("download:", regionX, regionY, regionW, regionH);
  // 특정 영역만 읽기
  gl.readPixels(regionX, regionY, regionW, regionH, gl.RG, gl.FLOAT, buf);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // GPU의 텍스처 좌표는 (0,0)이 왼쪽 아래!
  // CPU의 `outX, outY`는 일반 배열처럼 (0,0)이 왼쪽 위!

  for (let y = 0; y < regionH; y++) {
    for (let x = 0; x < regionW; x++) {
      let bufIdx = (y * regionW + x) * 2; // RG 채널이므로 *2
      let outIdx = (regionY + y) * width + (regionX + x); // 전체 outX, outY에서의 위치

      outX[outIdx] = buf[bufIdx]; // R 채널 → X 변위
      outY[outIdx] = buf[bufIdx + 1]; // G 채널 → Y 변위
    }
  }
}

/************************************************
 * WebGL2 + Ping-Pong
 ************************************************/
let webglCanvas, gl;
let width, height;
let glProgram, glVao;
let texA, texB; // Ping-Pong 텍스처
let fboA, fboB; // Ping-Pong FBO

async function initWebGL2(offscreenCanvas) {
  gl = offscreenCanvas.getContext("webgl2", { antialias: false });
  if (!gl) {
    throw new Error("WebGL2 not supported.");
  }
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    throw new Error("EXT_color_buffer_float not supported.");
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);

  // Vertex shader
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord= (aPos*0.5)+0.5;
    gl_Position= vec4(aPos,0,1);
  }`;
  // 단일 linePoint만 처리하는 셰이더 (순차 갱신)
  const SINGLE_POINT_FS = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  out vec2 outDisp; // 결과 (newX, newY)

  // prev state
  uniform sampler2D uOldDisp;
  uniform vec2 uResolution;

  // 단일 linePoint
  uniform vec2 uLinePoint;
  uniform vec2 uEnd;

  // bound
  uniform vec4 uBounds; // minX, minY, maxX, maxY

  uniform float uRadius;
  uniform float uStrength;

  // easing
  float easeInOutCubic(float x){
    return (x < 0.5)
      ? 4.0*x*x*x
      : 1.0 - pow(-2.0*x+2.0,3.0)/2.0;
  }

  vec2 getDisp(vec2 coord){
    return texture(uOldDisp, coord).rg;
  }

  void main(){
    vec2 coord = vTexCoord * uResolution;
    float x = floor(coord.x + 0.5);
    float y = floor(coord.y + 0.5);

    // bounding check
    if(x< uBounds.x || x>uBounds.z || y< uBounds.y || y>uBounds.w){
      outDisp = texture(uOldDisp, vTexCoord).rg;
      return;
    }

    vec2 oldVal = getDisp(vTexCoord);
    vec2 pt = uLinePoint;
    vec2 dxy= uEnd - pt;
    float len= length(dxy);
    if(len<1e-9){
      outDisp= oldVal;
      return;
    }
    vec2 unit= dxy/len;

    float dxp= x - pt.x;
    float dyp= y - pt.y;
    float dist= sqrt(dxp*dxp + dyp*dyp);
    if(dist>=uRadius){
      outDisp= oldVal;
      return;
    }

    bool hasLeft   = (x>0.0);
    bool hasRight  = (x< (uResolution.x-1.0));
    bool hasTop    = (y>0.0);
    bool hasBottom = (y< (uResolution.y-1.0));

    vec2 leftVal   = hasLeft   ? getDisp((coord + vec2(-1.0,0.0))/uResolution) : vec2(0.0);
    vec2 rightVal  = hasRight  ? getDisp((coord + vec2(+1.0,0.0))/uResolution) : vec2(0.0);
    vec2 topVal    = hasTop    ? getDisp((coord + vec2(0.0,-1.0))/uResolution): vec2(0.0);
    vec2 bottomVal = hasBottom ? getDisp((coord + vec2(0.0,+1.0))/uResolution): vec2(0.0);

    vec2 diffL= vec2(oldVal.x+1.0 - leftVal.x, oldVal.y - leftVal.y);
    vec2 diffR= vec2(rightVal.x+1.0 - oldVal.x, rightVal.y - oldVal.y);
    vec2 diffT= vec2(oldVal.x - topVal.x, oldVal.y+1.0 - topVal.y);
    vec2 diffB= vec2(bottomVal.x - oldVal.x, bottomVal.y+1.0 - oldVal.y);

    vec2 diffX= (unit.x>0.0)? diffL : diffR;
    vec2 diffY= (unit.y>0.0)? diffT : diffB;

    float factor= (1.0 - easeInOutCubic(dist/uRadius))* uStrength;
    float pow2Val= pow(2.0, factor);

    float offsetX = (diffX.x/pow2Val - diffX.x);
    float offsetY = (diffY.y/pow2Val - diffY.y);
    float offsetX2Y= (diffX.y/pow2Val - diffX.y);
    float offsetY2X= (diffY.x/pow2Val - diffY.x);

    float newX= oldVal.x + offsetX*unit.x + offsetY2X*unit.y;
    float newY= oldVal.y + offsetX2Y*unit.x + offsetY*unit.y;

    outDisp= vec2(newX, newY);
  }
  `;
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, SINGLE_POINT_FS, gl.FRAGMENT_SHADER);
  glProgram = linkProgram(gl, vs, fs);

  // VAO
  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);

  const quad = new Float32Array([-1, -1, +1, -1, -1, +1, +1, +1]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Ping-Pong 텍스처
  texA = gl.createTexture();
  texB = gl.createTexture();
  [texA, texB].forEach((tex) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      width,
      height,
      0,
      gl.RG,
      gl.FLOAT,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  });

  fboA = createFBO(texA);
  fboB = createFBO(texB);

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function createFBO(tex) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  return fbo;
}

function compileShader(gl, src, type) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error:\n" + gl.getShaderInfoLog(sh));
  }
  return sh;
}
function linkProgram(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link error:\n" + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/************************************************
 * GPU <-> CPU 함수
 ************************************************/
function uploadDisplaceToTex(srcX, srcY, tex) {
  const size = width * height * 2;
  const buf = new Float32Array(size);
  for (let i = 0; i < width * height; i++) {
    buf[i * 2 + 0] = srcX[i];
    buf[i * 2 + 1] = srcY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RG, gl.FLOAT, buf);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function downloadTexToDisplace(tex, fbo, outX, outY) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const buf = new Float32Array(width * height * 2);
  gl.readPixels(0, 0, width, height, gl.RG, gl.FLOAT, buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  for (let i = 0; i < width * height; i++) {
    outX[i] = buf[i * 2 + 0];
    outY[i] = buf[i * 2 + 1];
  }
}

/************************************************
 * 여러 linePoints를 "순차"로 누적 적용( Ping-Pong )
 ************************************************/
function gpuApplyPixelFlowLinePoints(linePoints) {
  // 0) GPU에 현재 displaceX,displaceY 업로드 => texA
  // uploadDisplaceToTex(displaceX, displaceY, texA);

  // 1) point마다 순차적으로
  for (let i = 0; i < linePoints.length; i++) {
    // (a) texA 읽기 → fboB(= texB) 쓰기
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(glProgram);
    gl.bindVertexArray(glVao);

    // uOldDisp => texA
    let loc = gl.getUniformLocation(glProgram, "uOldDisp");
    gl.uniform1i(loc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);

    // uResolution
    loc = gl.getUniformLocation(glProgram, "uResolution");
    gl.uniform2f(loc, width, height);

    // uLinePoint
    let pt = linePoints[i];
    loc = gl.getUniformLocation(glProgram, "uLinePoint");
    gl.uniform2f(loc, pt.x, pt.y);

    // uEnd => linePoints 전체의 마지막 점
    let endPt = linePoints[linePoints.length - 1];
    loc = gl.getUniformLocation(glProgram, "uEnd");
    gl.uniform2f(loc, endPt.x, endPt.y);

    // uRadius, uStrength
    loc = gl.getUniformLocation(glProgram, "uRadius");
    gl.uniform1f(loc, EFFECT_RADIUS);
    loc = gl.getUniformLocation(glProgram, "uStrength");
    gl.uniform1f(loc, MAGNIFY_STRENGTH);

    // bounding box: 전체 linePoints / 혹은 단일 point
    // 여기서는 단일 point에 대해서만 bound
    let boundMinX = Math.floor(pt.x - EFFECT_RADIUS);
    let boundMinY = Math.floor(pt.y - EFFECT_RADIUS);
    let boundMaxX = Math.ceil(pt.x + EFFECT_RADIUS);
    let boundMaxY = Math.ceil(pt.y + EFFECT_RADIUS);
    boundMinX = Math.max(0, boundMinX);
    boundMinY = Math.max(0, boundMinY);
    boundMaxX = Math.min(width - 1, boundMaxX);
    boundMaxY = Math.min(height - 1, boundMaxY);

    loc = gl.getUniformLocation(glProgram, "uBounds");
    gl.uniform4f(loc, boundMinX, boundMinY, boundMaxX, boundMaxY);

    // draw full screen
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // (b) fboB => CPU로 안 가져옴, 대신 swap: B => A
    //   A ← B
    //   (실제로 copy 없이 "핑퐁" swap)
    swapTex();
  }

  // 2) 모든 points 작업 완료 후,
  //    최종 texA 에는 누적 결과가 있음
  //    CPU 다운로드
  //downloadTexToDisplace(texA, fboA, displaceX, displaceY);
}

// 텍스처와 FBO를 swap
function swapTex() {
  // texA ↔ texB
  let t = texA;
  texA = texB;
  texB = t;
  // fboA ↔ fboB
  let f = fboA;
  fboA = fboB;
  fboB = f;
}
