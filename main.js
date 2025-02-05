/**********************************
 * 전역 설정과 초기화
 **********************************/
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 뒤틀기 효과 설정
const EFFECT_RADIUS = 200;
const MAGNIFY_STRENGTH = 2;

// 전역 배열
let displaceX, displaceY;
let originalImageData, originalData;

function initPixelFlow(canvas, ctx) {
  const width = canvas.width;
  const height = canvas.height;
  originalImageData = ctx.getImageData(0, 0, width, height);
  originalData = originalImageData.data;
  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

function renderToImage(canvas, sx, sy, ex, ey) {
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;
  const width = ex - sx;
  const height = ey - sy;
  if (sx === undefined || sy === undefined) return;

  const newImageData = new Uint8ClampedArray(width * height * 4);
  let idxx = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const index = y * canvas_w + x;
      const totalDx = displaceX[index];
      const totalDy = displaceY[index];
      let newX = x + totalDx;
      let newY = y + totalDy;

      // 2D 보간
      const floorX = Math.floor(newX);
      const floorY = Math.floor(newY);
      const ceilX = Math.ceil(newX);
      const ceilY = Math.ceil(newY);
      const tx = newX - floorX;
      const ty = newY - floorY;

      const getColor = (xx, yy) => {
        const clampedX = Math.min(Math.max(xx, 0), canvas_w - 1);
        const clampedY = Math.min(Math.max(yy, 0), canvas_h - 1);
        const idx = (clampedY * canvas_w + clampedX) * 4;
        return [
          originalData[idx + 0],
          originalData[idx + 1],
          originalData[idx + 2],
          originalData[idx + 3],
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
      const outIndex = idxx * 4;
      newImageData[outIndex + 0] = r;
      newImageData[outIndex + 1] = g;
      newImageData[outIndex + 2] = b;
      newImageData[outIndex + 3] = a;
      idxx++;
    }
  }

  let resultImageData = new ImageData(newImageData, width, height);
  ctx.putImageData(resultImageData, sx, sy);
}

// 이미지 로드 함수
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

/**********************************
 * Bresenham + 이벤트
 **********************************/
function getLinePoints(x0, y0, x1, y1) {
  if (
    !Number.isInteger(x0) ||
    !Number.isInteger(y0) ||
    !Number.isInteger(x1) ||
    !Number.isInteger(y1)
  ) {
    throw new Error("모든 좌표는 정수여야 합니다.");
  }
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

let positions = [];
let isTracking = false;

document.addEventListener("pointerdown", (evt) => {
  isTracking = true;
  positions = [];
});

document.addEventListener("pointermove", (evt) => {
  if (!isTracking) return;
  const x = Math.floor(evt.clientX);
  const y = Math.floor(evt.clientY);

  positions.push({ x, y });
  if (positions.length < 2) return;

  let lastIndex = positions.length - 1;
  let start = positions[lastIndex - 1];
  let end = positions[lastIndex];

  // Bresenham
  let linePts = getLinePoints(start.x, start.y, end.x, end.y);

  gpuApplyPixelFlowLine(linePts);

  // bounding box
  let boundMinX = Math.max(0, Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS));
  let boundMinY = Math.max(0, Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS));
  let boundMaxX = Math.min(canvas.width - 1, Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS));
  let boundMaxY = Math.min(canvas.height - 1, Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS));

  renderToImage(canvas, boundMinX, boundMinY, boundMaxX, boundMaxY);
});

document.addEventListener("pointerup", (evt) => {
  isTracking = false;
});

/**********************************
 * WebGL2 초기화 + Ping-Pong
 **********************************/
let webglCanvas, gl;
let width, height;
let glProgram, glVao;
let texIn, texOut, fboIn, fboOut;
const MAX_LINE_POINTS = 256;

window.onload = async () => {
  try {
    const img = await loadImageFromURL("check.png");
    drawImageToCanvas(img);

    initPixelFlow(canvas, ctx);

    // OffscreenCanvas for WebGL
    webglCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    width = canvas.width;
    height= canvas.height;

    await initWebGL2(webglCanvas);
  } catch (err) {
    console.error("이미지 로드 실패:", err);
  }
};

async function initWebGL2(offscreenCanvas) {
  gl = offscreenCanvas.getContext("webgl2", {antialias:false});
  if(!gl){
    throw new Error("WebGL2 not supported in OffscreenCanvas.");
  }
  const ext = gl.getExtension("EXT_color_buffer_float");
  if(!ext){
    throw new Error("EXT_color_buffer_float not supported.");
  }

  gl.viewport(0,0,width,height);
  gl.clearColor(0,0,0,1);

  // =========== Vertex Shader ===========
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos * 0.5) + 0.5;
    gl_Position = vec4(aPos, 0, 1);
  }`;

  // =========== Fragment Shader ===========
  const fsSource = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  out vec2 outDisp; // (newX, newY)

  uniform sampler2D uOldDisp;
  uniform vec2 uResolution;

  uniform int  uLineCount;
  uniform vec2 uLinePoints[${MAX_LINE_POINTS}];
  uniform vec2 uEnd;

  uniform vec4 uBounds; // minX, minY, maxX, maxY
  uniform float uRadius;
  uniform float uStrength;

  float easeInOutCubic(float x){
    return (x<0.5)
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

    // bounding box
    if(x < uBounds.x || x > uBounds.z || y < uBounds.y || y> uBounds.w){
      outDisp = texture(uOldDisp, vTexCoord).rg;
      return;
    }

    // partialVal
    vec2 partialVal = texture(uOldDisp, vTexCoord).rg;

    for(int i=0; i<${MAX_LINE_POINTS}; i++){
      if(i >= uLineCount) { break; }
      vec2 pt = uLinePoints[i];
      vec2 dxy = uEnd - pt;
      float len = length(dxy);
      if(len<1e-9){ continue; }
      vec2 unit = dxy / len;

      float dxp = x - pt.x;
      float dyp = y - pt.y;
      float dist = sqrt(dxp*dxp + dyp*dyp);
      if(dist >= uRadius) { continue; }

      bool hasLeft   = (x>0.0);
      bool hasRight  = (x<uResolution.x-1.0);
      bool hasTop    = (y>0.0);
      bool hasBottom = (y<uResolution.y-1.0);

      vec2 leftVal   = hasLeft   ? getDisp((coord+vec2(-1.0,0.0))/uResolution) : vec2(0.0);
      vec2 rightVal  = hasRight  ? getDisp((coord+vec2(+1.0,0.0))/uResolution) : vec2(0.0);
      vec2 topVal    = hasTop    ? getDisp((coord+vec2(0.0,-1.0))/uResolution) : vec2(0.0);
      vec2 bottomVal = hasBottom ? getDisp((coord+vec2(0.0,+1.0))/uResolution) : vec2(0.0);

      vec2 diffL = vec2(partialVal.x+1.0 - leftVal.x, partialVal.y - leftVal.y);
      vec2 diffR = vec2(rightVal.x+1.0 - partialVal.x, rightVal.y - partialVal.y);
      vec2 diffT = vec2(partialVal.x - topVal.x, partialVal.y+1.0 - topVal.y);
      vec2 diffB = vec2(bottomVal.x - partialVal.x, bottomVal.y+1.0 - partialVal.y);

      vec2 diffX = (unit.x>0.0)? diffL : diffR;
      vec2 diffY = (unit.y>0.0)? diffT : diffB;

      float factor = (1.0 - easeInOutCubic(dist/uRadius)) * uStrength;
      float pow2 = pow(2.0, factor);

      float offsetX = (diffX.x/pow2 - diffX.x);
      float offsetY = (diffY.y/pow2 - diffY.y);
      float offsetX2Y= (diffX.y/pow2 - diffX.y);
      float offsetY2X= (diffY.x/pow2 - diffY.x);

      float newX = partialVal.x + offsetX*unit.x + offsetY2X*unit.y;
      float newY = partialVal.y + offsetX2Y*unit.x + offsetY*unit.y;

      partialVal= vec2(newX, newY);
    }

    outDisp = partialVal;
  }
  `;

  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  glProgram = linkProgram(gl, vs, fs);

  // VAO
  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);

  const quad = new Float32Array([
    -1,-1,
    +1,-1,
    -1,+1,
    +1,+1
  ]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);

  // Ping-Pong 텍스처 + FBO
  [texIn, texOut] = [gl.createTexture(), gl.createTexture()];
  [texIn, texOut].forEach((tex)=>{
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0,
      gl.RG32F, width, height, 0,
      gl.RG, gl.FLOAT, null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  });

  fboIn = createFBO(texIn);
  fboOut= createFBO(texOut);

  gl.bindTexture(gl.TEXTURE_2D,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  function createFBO(tex){
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, tex,0
    );
    return fbo;
  }
}

/**********************************
 * WebGL 유틸
 **********************************/
function compileShader(gl, src, type){
  let sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    throw new Error("Shader compile error:\n"+gl.getShaderInfoLog(sh));
  }
  return sh;
}
function linkProgram(gl, vs, fs){
  let prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    throw new Error("Program link error:\n"+gl.getProgramInfoLog(prog));
  }
  return prog;
}

function uploadDisplaceToTex(displaceX, displaceY, tex){
  let size = width*height*2;
  let buf = new Float32Array(size);
  for(let i=0; i<width*height; i++){
    buf[i*2 + 0] = displaceX[i];
    buf[i*2 + 1] = displaceY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0,
    0,0, width, height,
    gl.RG, gl.FLOAT, buf
  );
  gl.bindTexture(gl.TEXTURE_2D,null);
}

function downloadTexToDisplace(tex, fbo, outX, outY){
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  let buf = new Float32Array(width*height*2);
  gl.readPixels(0,0,width,height, gl.RG, gl.FLOAT, buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  for(let i=0; i<width*height; i++){
    outX[i] = buf[i*2+0];
    outY[i] = buf[i*2+1];
  }
}

/**********************************
 * GPU applyPixelFlow
 **********************************/
function gpuApplyPixelFlowLine(linePoints){
  // CPU->GPU
  uploadDisplaceToTex(displaceX, displaceY, texIn);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fboOut);
  gl.viewport(0,0,width,height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(glProgram);
  gl.bindVertexArray(glVao);

  // uniform: uOldDisp => texIn
  let loc = gl.getUniformLocation(glProgram, "uOldDisp");
  gl.uniform1i(loc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texIn);

  // uResolution
  loc = gl.getUniformLocation(glProgram, "uResolution");
  gl.uniform2f(loc, width, height);

  // uRadius, uStrength
  loc = gl.getUniformLocation(glProgram, "uRadius");
  gl.uniform1f(loc, EFFECT_RADIUS);
  loc = gl.getUniformLocation(glProgram, "uStrength");
  gl.uniform1f(loc, MAGNIFY_STRENGTH);

  // linePoints -> uniform
  let n = Math.min(linePoints.length, MAX_LINE_POINTS);
  loc = gl.getUniformLocation(glProgram, "uLineCount");
  gl.uniform1i(loc, n);

  for(let i=0; i<n; i++){
    let lpLoc = gl.getUniformLocation(glProgram, `uLinePoints[${i}]`);
    gl.uniform2f(lpLoc, linePoints[i].x, linePoints[i].y);
  }

  // uEnd = 마지막 점
  let endPt = linePoints[linePoints.length-1];
  loc = gl.getUniformLocation(glProgram, "uEnd");
  gl.uniform2f(loc, endPt.x, endPt.y);

  // bounding box
  let boundMinX = Infinity, boundMinY=Infinity;
  let boundMaxX = -Infinity, boundMaxY=-Infinity;
  for(let i=0; i<linePoints.length; i++){
    let px = linePoints[i].x, py=linePoints[i].y;
    if(px<boundMinX) boundMinX=px;
    if(px>boundMaxX) boundMaxX=px;
    if(py<boundMinY) boundMinY=py;
    if(py>boundMaxY) boundMaxY=py;
  }
  boundMinX = Math.floor(boundMinX - EFFECT_RADIUS);
  boundMinY = Math.floor(boundMinY - EFFECT_RADIUS);
  boundMaxX = Math.ceil(boundMaxX + EFFECT_RADIUS);
  boundMaxY = Math.ceil(boundMaxY + EFFECT_RADIUS);

  boundMinX = Math.max(0,boundMinX);
  boundMinY = Math.max(0,boundMinY);
  boundMaxX = Math.min(width-1,boundMaxX);
  boundMaxY = Math.min(height-1,boundMaxY);

  loc = gl.getUniformLocation(glProgram,"uBounds");
  gl.uniform4f(loc, boundMinX,boundMinY, boundMaxX,boundMaxY);

  // draw
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  // GPU->CPU
  downloadTexToDisplace(texOut, fboOut, displaceX, displaceY);
}
