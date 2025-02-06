// worker.js
"use strict";

// ================== 전역 & 상수 ==================
const EFFECT_RADIUS = 100;
const MAGNIFY_STRENGTH = 1;

// CPU에서 2D캔버스용
let canvas2d, ctx2d; // 2D Canvas & context
let originalImageData, originalData;

// CPU 쪽에서 관리할 displaceX,Y
let displaceX, displaceY;

// WebGL2 전용 캔버스(Offscreen)
let webglCanvas, gl;
let width, height;

// WebGL 관련
let glProgram, glVao;
let texIn, texOut;
let fboIn, fboOut;

// 유니폼에 담을 수 있는 최대 linePoint 개수 (시연용, 1024개)
const MAX_LINE_POINTS = 256;

// ================== initPixelFlow ==================
function initPixelFlow(canvas, ctx) {
  width = canvas.width;
  height = canvas.height;

  // 원본 이미지
  originalImageData = ctx.getImageData(0, 0, width, height);
  originalData = originalImageData.data;

  // CPU 메모리 displace
  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

// ================== WebGL2 초기화 ==================
async function initWebGL2(offscreenCanvas) {
  // OffscreenCanvas로부터 WebGL2 context
  gl = offscreenCanvas.getContext("webgl2", { antialias: false });
  if (!gl) {
    throw new Error("WebGL2 not supported in OffscreenCanvas.");
  }
  // float 텍스처 확장
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    throw new Error("EXT_color_buffer_float not supported.");
  }

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);

  // 셰이더 컴파일
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos * 0.5) + 0.5; // [-1..1]->[0..1]
    gl_Position = vec4(aPos,0,1);
  }`;

  const fsSource = `#version 300 es
  precision highp float;

  // ------ 입력 ------
  in vec2 vTexCoord;
  out vec2 outDisp; // RG= (newX, newY)

  // 현재(이전) displace 텍스처
  uniform sampler2D uOldDisp;

  // 화면 크기
  uniform vec2 uResolution;

  // linePoints
  uniform int  uLineCount;                   // 실제 linePoints 개수
  uniform vec2 uLinePoints[${MAX_LINE_POINTS}]; // 최대 256
  uniform vec2 uEnd;                        // 마지막 점(=마우스)

  // bounding box (전체 linePoints 커버)
  uniform vec4 uBounds;   // (minX, minY, maxX, maxY)

  uniform float uRadius;
  uniform float uStrength;

  // ---------- CPU applyPixelFlow 로직과 동일한 easing -----------
  float easeInOutCubic(float x){
    return (x<0.5) ? 4.0*x*x*x : 1.0 - pow(-2.0*x+2.0,3.0)/2.0;
  }

  // 간단히 oldVal 읽기
  vec2 getDisp(vec2 coord){
    return texture(uOldDisp, coord).rg;
  }

  void main(){
    // 현재 픽셀 정수 좌표
    vec2 coord = vTexCoord * uResolution;
    float x = floor(coord.x+0.5);
    float y = floor(coord.y+0.5);

    // bounding box 검사
    if(x< uBounds.x || x>uBounds.z || y<uBounds.y || y>uBounds.w){
      // bounding 밖이면 업데이트 없음
      outDisp = texture(uOldDisp, vTexCoord).rg;
      return;
    }

    // oldVal
    vec2 partialVal = texture(uOldDisp, vTexCoord).rg;

    // linePoints 개수만큼 순차 업데이트
    // CPU에서: linePoints.forEach( pt => applyPixelFlow(pt, end) )
    for(int i=0; i<${MAX_LINE_POINTS}; i++){
      if(i >= uLineCount) { break; }

      // pt
      vec2 pt = uLinePoints[i];
      // dx = end.x - pt.x
      vec2 dxy = uEnd - pt;
      float length = length(dxy);
      if(length<0.0001){
        // length=0이면 skip
        continue;
      }
      // unitX = dx/length
      vec2 unit = dxy / length;

      // 현재 픽셀과 pt 사이 거리
      float dxp = x - pt.x;
      float dyp = y - pt.y;
      float dist = sqrt(dxp*dxp + dyp*dyp);
      if(dist>=uRadius){
        // 반경 밖 => 변화 없음
        continue;
      }

      // 4방 이웃
      bool hasLeft   = (x>0.0);
      bool hasRight  = (x<(uResolution.x-1.0));
      bool hasTop    = (y>0.0);
      bool hasBottom = (y<(uResolution.y-1.0));

      vec2 leftVal   = hasLeft   ? getDisp((vec2(x-1.0, y))/uResolution) : vec2(0.0);
      vec2 rightVal  = hasRight  ? getDisp((vec2(x+1.0, y))/uResolution) : vec2(0.0);
      vec2 topVal    = hasTop    ? getDisp((vec2(x,   y-1.0))/uResolution) : vec2(0.0);
      vec2 bottomVal = hasBottom ? getDisp((vec2(x,   y+1.0))/uResolution) : vec2(0.0);

      // CPU: diffL.x = partialVal.x +1.0 - leftVal.x ...
      vec2 diffL = vec2(partialVal.x+1.0 - leftVal.x, partialVal.y - leftVal.y);
      vec2 diffR = vec2(rightVal.x+1.0 - partialVal.x, rightVal.y - partialVal.y);
      vec2 diffT = vec2(partialVal.x - topVal.x, partialVal.y+1.0 - topVal.y);
      vec2 diffB = vec2(bottomVal.x - partialVal.x, bottomVal.y+1.0 - partialVal.y);

      // unit.x>0 ? diffL : diffR
      vec2 diffX = (unit.x>0.0)? diffL : diffR;
      vec2 diffY = (unit.y>0.0)? diffT : diffB;

      float eFactor = (1.0 - easeInOutCubic(dist/uRadius)) * uStrength;
      float pow2    = pow(2.0, eFactor);

      // offset
      float offsetX = (diffX.x/pow2 - diffX.x);
      float offsetY = (diffY.y/pow2 - diffY.y);

      float offsetX2Y = (diffX.y/pow2 - diffX.y);
      float offsetY2X = (diffY.x/pow2 - diffY.x);

      // partialVal.x += offsetX * unit.x + offsetY2X * unit.y
      // partialVal.y += offsetX2Y* unit.x + offsetY    * unit.y
      float newX = partialVal.x + offsetX*unit.x + offsetY2X*unit.y;
      float newY = partialVal.y + offsetX2Y*unit.x + offsetY*unit.y;

      partialVal = vec2(newX, newY);
    }

    // 최종 partialVal
    outDisp = partialVal;
  }
  `;

  // compile & link
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  glProgram = linkProgram(gl, vs, fs);

  // VAO
  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);

  let quad = new Float32Array([-1, -1, +1, -1, -1, +1, +1, +1]);
  let vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  // 텍스처 & FBO 2개 (ping-pong)
  [texIn, texOut] = [gl.createTexture(), gl.createTexture()];
  [texIn, texOut].forEach((tex) => {
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

  fboIn = createFBO(texIn);
  fboOut = createFBO(texOut);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
}

function compileShader(gl, src, type) {
  let sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error:\n" + gl.getShaderInfoLog(sh));
  }
  return sh;
}
function linkProgram(gl, vs, fs) {
  let p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link error:\n" + gl.getProgramInfoLog(p));
  }
  return p;
}

// ================== CPU <-> GPU 동기화 ==================
function uploadDisplaceToTex(displaceX, displaceY, tex) {
  let size = width * height * 2;
  let buf = new Float32Array(size);
  for (let i = 0; i < width * height; i++) {
    buf[i * 2 + 0] = displaceX[i];
    buf[i * 2 + 1] = displaceY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RG, gl.FLOAT, buf);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

let regionX = 10,
  regionY = 10; // 읽을 영역의 시작점
let regionW = 30,
  regionH = 30; // 읽을 영역의 크기
function downloadTexToDisplace(tex, fbo, outX, outY) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  // 가져올 데이터 버퍼 (2채널 RG)
  let buf = new Float32Array(regionW * regionH * 2);

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

// ================== GPU applyPixelFlow: 전체 linePoints를 한 번에 처리 ==================
function gpuApplyPixelFlowLine(linePoints) {
  // console.log(linePoints)
  // 1) CPU->GPU: displace -> texIn
  uploadDisplaceToTex(displaceX, displaceY, texIn);

  // 2) draw call (fboOut)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboOut);
  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(glProgram);
  gl.bindVertexArray(glVao);

  // uniform: uOldDisp => texIn
  let loc = gl.getUniformLocation(glProgram, "uOldDisp");
  gl.uniform1i(loc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texIn);

  // uniform: uResolution
  loc = gl.getUniformLocation(glProgram, "uResolution");
  gl.uniform2f(loc, width, height);

  // uniform: uRadius, uStrength
  loc = gl.getUniformLocation(glProgram, "uRadius");
  gl.uniform1f(loc, EFFECT_RADIUS);
  loc = gl.getUniformLocation(glProgram, "uStrength");
  gl.uniform1f(loc, MAGNIFY_STRENGTH);

  // linePoints => uniform array
  //   - 최대 MAX_LINE_POINTS개
  let n = Math.min(linePoints.length, MAX_LINE_POINTS);

  // uLineCount
  loc = gl.getUniformLocation(glProgram, "uLineCount");
  gl.uniform1i(loc, n);

  // uLinePoints[..]
  for (let i = 0; i < n; i++) {
    let pointLoc = gl.getUniformLocation(glProgram, `uLinePoints[${i}]`);
    gl.uniform2f(pointLoc, linePoints[i].x, linePoints[i].y);
  }

  // uEnd: linePoints의 마지막
  let endPt = linePoints[linePoints.length - 1];
  loc = gl.getUniformLocation(glProgram, "uEnd");
  gl.uniform2f(loc, endPt.x, endPt.y);

  // bounding box
  let boundMinX = Infinity,
    boundMinY = Infinity;
  let boundMaxX = -Infinity,
    boundMaxY = -Infinity;
  for (let i = 0; i < linePoints.length; i++) {
    let px = linePoints[i].x,
      py = linePoints[i].y;
    if (px < boundMinX) boundMinX = px;
    if (px > boundMaxX) boundMaxX = px;
    if (py < boundMinY) boundMinY = py;
    if (py > boundMaxY) boundMaxY = py;
  }
  // 반경 고려
  boundMinX = Math.floor(boundMinX - EFFECT_RADIUS);
  boundMinY = Math.floor(boundMinY - EFFECT_RADIUS);
  boundMaxX = Math.ceil(boundMaxX + EFFECT_RADIUS);
  boundMaxY = Math.ceil(boundMaxY + EFFECT_RADIUS);

  // clamp
  boundMinX = Math.max(0, boundMinX);
  boundMinY = Math.max(0, boundMinY);
  boundMaxX = Math.min(width - 1, boundMaxX);
  boundMaxY = Math.min(height - 1, boundMaxY);

  loc = gl.getUniformLocation(glProgram, "uBounds");
  // (minX, minY, maxX, maxY)
  gl.uniform4f(loc, boundMinX, boundMinY, boundMaxX, boundMaxY);

  // 풀스크린 드로우
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // 3) GPU->CPU
  downloadTexToDisplace(texOut, fboOut, displaceX, displaceY);
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

// ================== 메시지 핸들러 ==================
onmessage = async function (e) {
  const data = e.data;
  if (data.type === "init") {
    // data.canvas2d => 2D용, data.webglCanvas => WebGL2용
    canvas2d = data.canvas;
    ctx2d = canvas2d.getContext("2d");

    // 이미지 로드
    try {
      const resp = await fetch(data.imageUrl);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);

      canvas2d.width = bitmap.width;
      canvas2d.height = bitmap.height;
      ctx2d.drawImage(bitmap, 0, 0);

      // CPU init
      initPixelFlow(canvas2d, ctx2d);

      // WebGL2 init (OffscreenCanvas)
      webglCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      await initWebGL2(webglCanvas);
    } catch (err) {
      console.error("이미지 로드 실패:", err);
    }
  } else if (data.type === "applyLine") {
    // pointermove 후 linePoints를 한 번에 처리
    const linePoints = data.linePoints; // [{x,y},...]
    // GPU에서 한 번에 처리
    gpuApplyPixelFlowLine(linePoints);

    const start = linePoints[0];
    const end = linePoints[linePoints.length - 1];

    // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
    const boundMinX = Math.max(
      0,
      Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS),
    );
    const boundMinY = Math.max(
      0,
      Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS),
    );

    const boundMaxX = Math.min(
      width - 1,
      Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS),
    );

    const boundMaxY = Math.min(
      height - 1,
      Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS),
    );

    renderToImage(canvas2d, ctx2d, boundMinX, boundMinY, boundMaxX, boundMaxY);
  }
};
function renderToImage(canvas, ctx, sx, sy, ex, ey) {
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;

  const width = ex - sx;
  const height = ey - sy;

  if (width <= 0 || height <= 0) {
    return;
  }

  console.log("heelo?");
  const newImageData = new Uint8ClampedArray(width * height * 4);
  let imageIndex = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const index = y * canvas_w + x;
      const totalDx = displaceX[index];
      const totalDy = displaceY[index];
      let newX = x + totalDx;
      let newY = y + totalDy;

      const floorX = Math.floor(newX);
      const floorY = Math.floor(newY);
      const ceilX = Math.ceil(newX);
      const ceilY = Math.ceil(newY);
      const tx = newX - floorX;
      const ty = newY - floorY;

      const getColor = (xx, yy) => {
        const clampedX = Math.min(Math.max(xx, 0), canvas_w - 1);
        const clampedY = Math.min(Math.max(yy, 0), canvas_h - 1);
        const idx = clampedY * canvas_w + clampedX;
        const base = idx * 4;
        return [
          originalData[base],
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
      const newIndex = imageIndex * 4;
      newImageData[newIndex] = r;
      newImageData[newIndex + 1] = g;
      newImageData[newIndex + 2] = b;
      newImageData[newIndex + 3] = a;
      imageIndex++;
    }
  }

  let resultImageData = new ImageData(newImageData, width, height);
  ctx.putImageData(resultImageData, sx, sy);
}
