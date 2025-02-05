// worker.js
"use strict";

// -------------------- 기존 상수 & 전역 변수 --------------------
const EFFECT_RADIUS = 100; // 뒤틀기 반경
const MAGNIFY_STRENGTH = 1; // 강도(+정방향, -역방향)

let canvas, ctx;
let lastIndex = 0;
let isTracking = false;
let positions = [];

// CPU에서 관리하는 원본 이미지/배열
let originalImageData;
let originalData;

// CPU 쪽의 displaceX/Y (GPU 연산 후 다운로드해서 저장)
let displaceX;
let displaceY;

// -------------------- WebGL 관련 전역 --------------------
let gl;                      // WebGL2 context
let glProgram;              // 셰이더 프로그램
let glVao;                  // 풀스크린 사각형용 VAO
let texIn, texOut;          // RG32F 텍스처 (Ping/Pong)
let fboIn, fboOut;          // 각 텍스처 붙은 FBO
let width, height;          // 캔버스 크기
let linePointsBuffer = null;// 실수로 Uniform-배열 전달 (브레젠험)

// -------------------- 초기화 함수 --------------------
// initPixelFlow: 원본 이미지 데이터 + CPU displaceX/Y 준비
function initPixelFlow(canvas, ctx) {
  width = canvas.width;
  height = canvas.height;

  originalImageData = ctx.getImageData(0, 0, width, height);
  originalData = originalImageData.data;

  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

// -------------------- GPU 초기화 및 셰이더 준비 --------------------
async function initWebGL2(canvas) {
  gl = canvas.getContext("webgl2", { antialias: false });
  if (!gl) {
    throw new Error("WebGL2 not supported.");
  }
  // float 확장(32bit RGBA)
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    throw new Error("이 브라우저는 EXT_color_buffer_float 미지원.");
  }
  gl.viewport(0, 0, width, height);

  // Clear color
  gl.clearColor(0,0,0,1);

  // 1) 셰이더 소스 준비: CPU applyPixelFlow로직을 GLSL로 변환
  //    이 셰이더는 ping 텍스처를 읽어, 4방향 diff 및 applyPixelFlow 계산 후 pong 텍스처에 씀.
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos * 0.5) + 0.5; // [-1..1]->[0..1]
    gl_Position = vec4(aPos, 0, 1);
  }`;

  // **가장 핵심**: CPU applyPixelFlow 로직을 거의 그대로 GLSL로 변환
  //  - RG 텍스처에 (displaceX, displaceY) 저장.
  //  - 4방향 픽셀(좌,우,상,하) 읽어서 diff 계산
  //  - dist < EFFECT_RADIUS 일 때만 업데이트
  //  - unitX>0 ? diffL : diffR ... 같은 if문 처리
  //  - bounding region도 체크 (x,y가 [boundMinX..boundMaxX], etc)
  //  - linePoints도 uniform 배열로 전달해, 그 중 마지막 점(end)에 대해서만 unitX,unitY,등 계산
  const fsSource = `#version 300 es
  precision highp float;

  in vec2 vTexCoord;
  out vec2 outDisp;          // R= displaceX, G= displaceY

  uniform sampler2D uOldDisp; // 이전 상태
  uniform vec2 uResolution;   // (width,height)
  uniform float uEffectRadius;
  uniform float uStrength;

  // linePoints 배열 & end 좌표
  //  - 브레젠험으로 구한 (start.x, start.y)를 하나씩 적용
  //  - 실제론 각 픽셀이 모든 linePoints에 대해 dist<radius 인지 검사 -> 비효율
  //  - 여기서는 "마지막 point"만 처리하거나, uniform로 boundary만 처리 (간소화)
  //   => 실무서는 computeShader 권장
  uniform vec2 uEnd;       // 최종점
  uniform vec2 uDirUnit;   // (unitX, unitY) = 방향
  uniform float uLength;   // dxdy 벡터 크기
  uniform float uBoundMinX, uBoundMinY, uBoundMaxX, uBoundMaxY;
  uniform vec2 uStart;     // 브러시 시작점

  // easing
  float easeInOutCubic(float x){
    return (x < 0.5)
      ? 4.0 * x*x*x
      : 1.0 - pow(-2.0*x + 2.0,3.0)/2.0;
  }

  // fetch displace from old tex
  vec2 getDisp(vec2 coord){ // coord in [0..1]
    return texture(uOldDisp, coord).rg;
  }

  void main(){
    // 현재 픽셀 정수 좌표
    vec2 coord = vTexCoord * uResolution; // [0..width, 0..height]
    float x = floor(coord.x + 0.5);
    float y = floor(coord.y + 0.5);

    // oldVal
    vec2 oldVal = getDisp(vTexCoord);

    // bounding region 체크
    if(x < uBoundMinX || x > uBoundMaxX || y < uBoundMinY || y> uBoundMaxY){
      // 바운드 밖이면 업데이트 없음
      outDisp = oldVal;
      return;
    }

    // dist check
    float dx = x - uStart.x;
    float dy = y - uStart.y;
    float dist = length(vec2(dx,dy));
    if(dist >= uEffectRadius){
      // 반경 밖
      outDisp = oldVal;
      return;
    }

    // 4방향 이웃
    //  좌픽셀
    bool hasLeft = (x>0.0);
    vec2 leftVal = hasLeft ? getDisp((vec2(x-1.0,y))/uResolution) : vec2(0.0);

    //  우픽셀
    bool hasRight = (x<(uResolution.x-1.0));
    vec2 rightVal= hasRight? getDisp((vec2(x+1.0,y))/uResolution) : vec2(0.0);

    //  상픽셀
    bool hasTop = (y>0.0);
    vec2 topVal = hasTop ? getDisp((vec2(x,y-1.0))/uResolution) : vec2(0.0);

    //  하픽셀
    bool hasBottom = (y<(uResolution.y-1.0));
    vec2 bottomVal = hasBottom? getDisp((vec2(x,y+1.0))/uResolution) : vec2(0.0);

    // diffL, diffR, diffT, diffB
    // diffL.x = displaceX[index] +1 - leftDisplaceX
    // oldVal.x +1.0 - leftVal.x ...
    vec2 diffL = vec2(oldVal.x+1.0 - leftVal.x, oldVal.y - leftVal.y);
    vec2 diffR = vec2(rightVal.x+1.0 - oldVal.x, rightVal.y - oldVal.y);
    vec2 diffT = vec2(oldVal.x - topVal.x, oldVal.y+1.0 - topVal.y);
    vec2 diffB = vec2(bottomVal.x - oldVal.x, bottomVal.y+1.0 - oldVal.y);

    // unitX>0 ? diffL : diffR
    vec2 diffX = (uDirUnit.x > 0.0) ? diffL : diffR;
    // unitY>0 ? diffT : diffB
    vec2 diffY = (uDirUnit.y > 0.0) ? diffT : diffB;

    float effectFactor = (1.0 - easeInOutCubic(dist / uEffectRadius)) * uStrength;

    // offsetX = diffX.x / 2^effectFactor - diffX.x
    float pow2 = pow(2.0, effectFactor);
    vec2 offsetXY = vec2(
      (diffX.x/pow2 - diffX.x),
      (diffY.y/pow2 - diffY.y)
    );
    vec2 offsetXY2 = vec2(
      (diffX.y/pow2 - diffX.y),
      (diffY.x/pow2 - diffY.x)
    );

    // displaceX[index] += offsetX * unitX
    // displaceY[index] += offsetX2Y * unitX
    // displaceY[index] += offsetY * unitY
    // displaceX[index] += offsetY2X * unitY
    float newX = oldVal.x + offsetXY.x * uDirUnit.x + offsetXY2.y * uDirUnit.y;
    float newY = oldVal.y + offsetXY2.x * uDirUnit.x + offsetXY.y * uDirUnit.y;

    outDisp = vec2(newX, newY);
  }`;

  // 2) 컴파일 & 링크
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  glProgram = linkProgram(gl, vs, fs);

  // 3) 풀스크린 사각형 VAO
  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);

  const quadData = new Float32Array([
    -1,-1,
    +1,-1,
    -1,+1,
    +1,+1
  ]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

  gl.bindVertexArray(null);

  // 4) 텍스처 & FBO 2개 생성 (Ping-Pong)
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
  const createFBO = (tex)=>{
    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0
    );
    return fbo;
  };
  fboIn = createFBO(texIn);
  fboOut= createFBO(texOut);

  // unbind
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.bindTexture(gl.TEXTURE_2D,null);
}

// -------------------- 쉐이더 헬퍼 --------------------
function compileShader(gl, source, type){
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    throw new Error("Shader compile error:\n"+gl.getShaderInfoLog(sh));
  }
  return sh;
}
function linkProgram(gl, vs, fs){
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    throw new Error("Program link error:\n"+gl.getProgramInfoLog(prog));
  }
  return prog;
}

// -------------------- CPU <-> GPU 동기화 --------------------
function uploadDisplacementToTex(displaceX, displaceY, tex){
  // RG float
  let size = width*height*2;
  const buf = new Float32Array(size);
  for(let i=0; i<width*height; i++){
    buf[i*2+0] = displaceX[i];
    buf[i*2+1] = displaceY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0,
    0,0, width, height,
    gl.RG, gl.FLOAT,
    buf
  );
  gl.bindTexture(gl.TEXTURE_2D,null);
}

function downloadTexToDisplacement(tex, fbo, displaceX, displaceY){
  // fbo에 tex가 붙어있다고 가정
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  let buf = new Float32Array(width*height*2);
  gl.readPixels(0,0,width,height, gl.RG, gl.FLOAT, buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  for(let i=0; i<width*height; i++){
    displaceX[i] = buf[i*2+0];
    displaceY[i] = buf[i*2+1];
  }
}

// -------------------- GPU applyPixelFlow --------------------
function gpuApplyPixelFlow(start, end){
  // 1) CPU->GPU (displaceX, displaceY -> texIn)
  uploadDisplacementToTex(displaceX, displaceY, texIn);

  // 2) glProgram 사용, fboOut에 드로우
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboOut);
  gl.viewport(0,0,width,height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(glProgram);
  gl.bindVertexArray(glVao);

  // Uniform 세팅
  //   - uOldDisp => texIn (texture unit 0)
  let loc = gl.getUniformLocation(glProgram, "uOldDisp");
  gl.uniform1i(loc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texIn);

  //   - uResolution
  loc = gl.getUniformLocation(glProgram,"uResolution");
  gl.uniform2f(loc, width, height);

  loc = gl.getUniformLocation(glProgram,"uEffectRadius");
  gl.uniform1f(loc, EFFECT_RADIUS);

  loc = gl.getUniformLocation(glProgram,"uStrength");
  gl.uniform1f(loc, MAGNIFY_STRENGTH);

  // 브러시 start->end
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx*dx+dy*dy)||1e-9;
  let unitX = dx/length;
  let unitY = dy/length;

  // bounding
  const boundMinX = Math.max(0, Math.floor(start.x - EFFECT_RADIUS));
  const boundMinY = Math.max(0, Math.floor(start.y - EFFECT_RADIUS));
  const boundMaxX = Math.min(width-1,  Math.ceil(start.x + EFFECT_RADIUS));
  const boundMaxY = Math.min(height-1, Math.ceil(start.y + EFFECT_RADIUS));

  loc = gl.getUniformLocation(glProgram, "uBoundMinX");
  gl.uniform1f(loc, boundMinX);
  loc = gl.getUniformLocation(glProgram, "uBoundMinY");
  gl.uniform1f(loc, boundMinY);
  loc = gl.getUniformLocation(glProgram, "uBoundMaxX");
  gl.uniform1f(loc, boundMaxX);
  loc = gl.getUniformLocation(glProgram, "uBoundMaxY");
  gl.uniform1f(loc, boundMaxY);

  // uStart, uEnd, uDirUnit, uLength
  loc = gl.getUniformLocation(glProgram,"uStart");
  gl.uniform2f(loc, start.x, start.y);

  loc = gl.getUniformLocation(glProgram,"uEnd");
  gl.uniform2f(loc, end.x, end.y);

  loc = gl.getUniformLocation(glProgram,"uDirUnit");
  gl.uniform2f(loc, unitX, unitY);

  loc = gl.getUniformLocation(glProgram,"uLength");
  gl.uniform1f(loc, length);

  // 풀스크린 드로우
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // unbind
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  // 3) GPU->CPU (texOut -> displaceX,displaceY)
  downloadTexToDisplacement(texOut, fboOut, displaceX, displaceY);
}

// -------------------- CPU renderToImage 그대로 사용 --------------------
function renderToImage(sx, sy, ex, ey){
  // 기존 CPU 로직 동일
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;
  const w = ex - sx, h = ey - sy;
  if(w<=0||h<=0) return;

  const newImageData = new Uint8ClampedArray(w*h*4);
  let idxOut=0;

  for(let y=sy; y<ey; y++){
    for(let x=sx; x<ex; x++){
      const index = y*canvas_w + x;
      let totalDx = displaceX[index];
      let totalDy = displaceY[index];
      let newX = x+totalDx, newY = y+totalDy;

      const floorX = Math.floor(newX), floorY = Math.floor(newY);
      const ceilX  = Math.ceil(newX),  ceilY  = Math.ceil(newY);
      const tx = newX - floorX, ty = newY - floorY;

      const getColor = (xx,yy)=>{
        let cx = Math.min(Math.max(xx,0),canvas_w-1);
        let cy = Math.min(Math.max(yy,0),canvas_h-1);
        let base = (cy*canvas_w + cx)*4;
        return [
          originalData[base+0],
          originalData[base+1],
          originalData[base+2],
          originalData[base+3],
        ];
      };

      const c00 = getColor(floorX, floorY);
      const c10 = getColor(ceilX,  floorY);
      const c01 = getColor(floorX, ceilY);
      const c11 = getColor(ceilX,  ceilY);

      const r = (c00[0]*(1-tx)+ c10[0]*tx)*(1-ty) + (c01[0]*(1-tx)+ c11[0]*tx)*ty;
      const g = (c00[1]*(1-tx)+ c10[1]*tx)*(1-ty) + (c01[1]*(1-tx)+ c11[1]*tx)*ty;
      const b = (c00[2]*(1-tx)+ c10[2]*tx)*(1-ty) + (c01[2]*(1-tx)+ c11[2]*tx)*ty;
      const a = (c00[3]*(1-tx)+ c10[3]*tx)*(1-ty) + (c01[3]*(1-tx)+ c11[3]*tx)*ty;

      let baseOut = idxOut*4;
      newImageData[baseOut+0] = r;
      newImageData[baseOut+1] = g;
      newImageData[baseOut+2] = b;
      newImageData[baseOut+3] = a;
      idxOut++;
    }
  }
  let imgData = new ImageData(newImageData, w, h);
  ctx.putImageData(imgData, sx, sy);
}

// -------------------- Bresenham + 이벤트 핸들러 --------------------
function getLinePoints(x0,y0,x1,y1){
  if(!Number.isInteger(x0)||!Number.isInteger(y0)||!Number.isInteger(x1)||!Number.isInteger(y1)){
    throw new Error("모든 좌표는 정수여야 합니다.");
  }
  const pts=[];
  let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
  let sx=(x0<x1?1:-1), sy=(y0<y1?1:-1);
  let err=dx-dy;
  while(true){
    pts.push({x:x0,y:y0});
    if(x0===x1 && y0===y1) break;
    let e2=2*err;
    if(e2>-dy){ err-=dy; x0+=sx; }
    if(e2< dx){ err+=dx; y0+=sy; }
  }
  return pts;
}

// -------------------- 메시지 핸들러 (핵심) --------------------
onmessage = async function(e){
  const data = e.data;
  if(data.type==="init"){
    // OffscreenCanvas & image URL
    canvas = data.canvas;
    ctx = canvas.getContext("2d");

    // 이미지 로드
    try{
      const resp = await fetch(data.imageUrl);
      const blob = await resp.blob();
      const imgBitmap = await createImageBitmap(blob);

      canvas.width = imgBitmap.width;
      canvas.height= imgBitmap.height;
      ctx.drawImage(imgBitmap,0,0);

      // CPU 배열 init
      initPixelFlow(canvas, ctx);

      let webglCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      
      // GPU init
      await initWebGL2(webglCanvas);
    } catch(err){
      console.error("이미지 로드 실패:", err);
    }
  }
  else if(data.type==="pointerdown"){
    isTracking = true;
    positions = [];
    positions.push({ x:data.x, y:data.y});
    lastIndex=0;
  }
  else if(data.type==="pointermove"){
    if(!isTracking) return;
    positions.push({ x:data.x, y:data.y });
    if(positions.length<2) return;

    lastIndex= positions.length-1;
    const start = positions[lastIndex-1];
    const end   = positions[lastIndex];

    // 브레젠험
    const linePts = getLinePoints(start.x,start.y, end.x,end.y);

    // bound
    const boundMinX = Math.max(0, Math.floor(Math.min(start.x,end.x) - EFFECT_RADIUS));
    const boundMinY = Math.max(0, Math.floor(Math.min(start.y,end.y) - EFFECT_RADIUS));
    const boundMaxX = Math.min(canvas.width-1,  Math.ceil(Math.max(start.x,end.x)+EFFECT_RADIUS));
    const boundMaxY = Math.min(canvas.height-1, Math.ceil(Math.max(start.y,end.y)+EFFECT_RADIUS));

    // linePts 마다 gpuApplyPixelFlow
    //  ==> 실제로는 linePts.length회 => 성능 문제 있으나 요청대로 구현
    linePts.forEach(pt=>{
      gpuApplyPixelFlow(pt, end);
    });

    // CPU쪽 displaceX/Y 갱신됨 -> renderToImage
    renderToImage(boundMinX, boundMinY, boundMaxX, boundMaxY);
  }
  else if(data.type==="pointerup"){
    isTracking=false;
  }
};

/* 
  ====================== CPU 버전 applyPixelFlow (주석처리) =====================

    // 원본 CPU 함수. 이제 WebGL2셰이더에서 동일 로직 수행하므로 사용안함.
    function applyPixelFlow(start, end){...}

*/

