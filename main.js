// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 100; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

let lastIndex = 0;
let displaceX;
let displaceY;
let originalImageData;
let originalData;

function initPixelFlow(canvas, ctx) {
  const width = canvas.width;
  const height = canvas.height;

  // 원본 이미지 데이터 가져오기
  originalImageData = ctx.getImageData(0, 0, width, height);
  originalData = originalImageData.data;

  // 변위 맵 초기화
  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

function applyPixelFlow(canvas, start, end) {
  const width = canvas.width;
  const height = canvas.height;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;
  const unitX = dx / length;
  const unitY = dy / length;

  // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
  const boundMinX = Math.max(
    0,
    Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS),
  );
  const boundMaxX = Math.min(
    width - 1,
    Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS),
  );
  const boundMinY = Math.max(
    0,
    Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS),
  );
  const boundMaxY = Math.min(
    height - 1,
    Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS),
  );

  // unit 방향에 따라 for문 시작점, 끝점, step 결정
  // x축
  let xStart, xEnd, stepX;
  if (unitX >= 0) {
    xStart = boundMinX;
    xEnd = boundMaxX;
    stepX = 1;
  } else {
    xStart = boundMaxX;
    xEnd = boundMinX;
    stepX = -1;
  }
  // y축
  let yStart, yEnd, stepY;
  if (unitY >= 0) {
    yStart = boundMinY;
    yEnd = boundMaxY;
    stepY = 1;
  } else {
    yStart = boundMaxY;
    yEnd = boundMinY;
    stepY = -1;
  }
  let sum = 0;
  // y 반복: 조건은 stepY의 부호에 따라 달라짐
  for (let y = yStart; stepY > 0 ? y <= yEnd : y >= yEnd; y += stepY) {
    // x 반복: 조건은 stepX의 부호에 따라 달라짐
    for (let x = xStart; stepX > 0 ? x <= xEnd : x >= xEnd; x += stepX) {
      sum++;
      const index = y * width + x;

      // 현재 픽셀의 실제 화면상의 좌표 (displaceX, displaceY가 적용되어 있다면 추가)
      const currentX = x; // + displaceX[index];
      const currentY = y; // + displaceY[index];

      // start~end 선분과 현재 픽셀 간의 최단거리 계산
      const px = currentX - start.x;
      const py = currentY - start.y;
      const t = (px * unitX + py * unitY) / length;
      const clampedT = Math.max(0, Math.min(1, t));
      const closestX = start.x + clampedT * dx;
      const closestY = start.y + clampedT * dy;
      const distX = currentX - closestX;
      const distY = currentY - closestY;
      const dist = Math.sqrt(distX * distX + distY * distY);

      if (dist < EFFECT_RADIUS) {
        let diffX, diffY;
        // 4방향의 차이를 저장할 객체 (x, y 프로퍼티)
        let diffL = { x: 0, y: 0 },
          diffR = { x: 0, y: 0 },
          diffT = { x: 0, y: 0 },
          diffB = { x: 0, y: 0 };

        // x축: unitX에 따라 좌측 혹은 우측 픽셀과의 차이 계산

        if (x == 0) {
          // 이런거 +1 해주는거는 테두리에 투명색 1픽셀 해주는거임
          diffL.x = displaceX[index] + 1;
          diffL.y = displaceY[index];
        } else {
          let leftIdx = y * width + (x - 1);
          diffL.x = displaceX[index] + 1 - displaceX[leftIdx];
          diffL.y = displaceY[index] - displaceY[leftIdx];
        }

        // <-으로 밀기

        // <-으로 밀기
        if (x == width - 1) {
          diffR.x = -displaceX[index] + 1;
          diffR.y = -displaceY[index];
        } else {
          let rightIdx = y * width + (x + 1);
          diffR.x = displaceX[rightIdx] + 1 - displaceX[index];
          diffR.y = displaceY[rightIdx] - displaceY[index];
        }

        // y축: unitY에 따라 위쪽 혹은 아래쪽 픽셀과의 차이 계산

        //아래로 밀기, 위랑 비교
        if (y == 0) {
          diffT.x = displaceX[index];
          diffT.y = displaceY[index] + 1; // or 탑이 1
        } else {
          let topIdx = (y - 1) * width + x;
          diffT.x = displaceX[index] - displaceX[topIdx];
          diffT.y = displaceY[index] + 1 - displaceY[topIdx];
        }

        if (y == height - 1) {
          diffB.x = -displaceX[index];
          diffB.y = -displaceY[index] + 1; // or 바텀이 -1
        } else {
          let bottomIdx = (y + 1) * width + x;
          diffB.x = displaceX[bottomIdx] - displaceX[index];
          diffB.y = displaceY[bottomIdx] + 1 - displaceY[index];
        }

        // x, y 각각에 대해 해당 방향의 차이를 선택
        diffX = unitX > 0 ? diffL : diffR;
        diffY = unitY > 0 ? diffT : diffB;

        // 효과 적용 인자 계산
        // x 가 0에 가까워질수록 1에 근접해가고, x == 1이면 정확히 0이고,
        // x가 1에 가까워질수록 1에 근접해진다. 이때는 정확히 1이 아니여도 된다.

        // 선형
        const linearEffect = (x) => x;
        // 사인함수

        const easeInOutSine = (x) => {
          return -0.5 * (Math.cos(Math.PI * x) - 1);
        };

        const easeInOutCubic = (x) =>
          x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

        const effectFactor =
          (1 - easeInOutCubic(dist / EFFECT_RADIUS)) * -MAGNIFY_STRENGTH;

        const offsetX = ((effectFactor * unitX) / 2) * diffX.x;
        const offsetY = ((effectFactor * unitY) / 2) * diffY.y;
        const maxoffsetX = effectFactor * unitX * 10 * diffX.x;
        const maxoffsetY = effectFactor * unitY * 10 * diffY.y;

        // x방향으로 밀었을 때 y값 보정, y방향으로 밀었을 때 x값 보정
        const offsetX2Y = ((effectFactor * unitX) / 2) * diffX.y;
        const offsetY2X = ((effectFactor * unitY) / 2) * diffY.x;
        const maxoffsetX2Y = effectFactor * unitX * 10 * diffX.y;
        const maxoffsetY2X = effectFactor * unitY * 10 * diffY.x;

        // 누적 변위 업데이트 (smallerAbs는 두 값 중 절대값이 작은 쪽을 반환하는 함수)
        displaceX[index] += smallerAbs(offsetX, maxoffsetX);
        displaceY[index] += smallerAbs(offsetY, maxoffsetY);
        displaceY[index] += smallerAbs(offsetX2Y, maxoffsetX2Y);
        displaceX[index] += smallerAbs(offsetY2X, maxoffsetY2X);
      }
    }
  }

  console.log(sum);
}

function renderToImage(canvas, sx, sy, ex, ey) {
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;
  const width = ex - sx;
  const height = ey - sy;

  if (sx == undefined) {
    return;
  }
  const newImageData = new Uint8ClampedArray(width * height * 4);

  let idxx = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const index = y * canvas_w + x;

      const totalDx = displaceX[index];
      const totalDy = displaceY[index];
      let newX = x + totalDx;
      let newY = y + totalDy;

      // 좌표를 이미지 경계 내로 클램핑
      // 이걸 주석하면 더욱더 바깥 색을 잘 표현함. 아마?
      // newX = Math.min(Math.max(newX, 0), canvas_w - 1);
      // newY = Math.min(Math.max(newY, 0), canvas_h - 1);

      // 양선형 보간
      const floorX = Math.floor(newX);
      const floorY = Math.floor(newY);
      const ceilX = Math.ceil(newX);
      const ceilY = Math.ceil(newY);
      const tx = newX - floorX;
      const ty = newY - floorY;

      const getColor = (xx, yy) => {
        // 클램핑된 좌표를 사용
        const clampedX = Math.min(Math.max(xx, 0), canvas_w - 1);
        const clampedY = Math.min(Math.max(yy, 0), canvas_h - 1);
        const idx = (clampedY * canvas_w + clampedX) * 4;
        // 화면 밖이면 투명으로 설정
        //     if (xx < 0 || xx >= canvas_w || yy < 0 || yy >= canvas_h) {
        //         return [
        //             originalData[idx],
        //                 originalData[idx + 1],
        //                 originalData[idx + 2],
        //             0,
        //         ];
        //     }

        return [
          originalData[idx],
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
      const newIndex = idxx * 4;
      newImageData[newIndex] = r;
      newImageData[newIndex + 1] = g;
      newImageData[newIndex + 2] = b;
      newImageData[newIndex + 3] = a;

      idxx++;
    }
  }

  let resultImageData = new ImageData(newImageData, width, height);
  ctx.putImageData(resultImageData, sx, sy);
}

const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

// 초기화
window.onload = async () => {
  try {
    const img = await loadImageFromURL("check.png");
    //const img = await loadImageFromURL("cat.webp");
    //const img = await loadImageFromURL("musk.png");
    drawImageToCanvas(img);

    initPixelFlow(canvas, ctx);

    // WebGL2 초기화 (OffscreenCanvas를 새로 생성)
      webglCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    width= canvas.width;
    height = canvas.height;
      await initWebGL2(webglCanvas);
  } catch (error) {
    console.error("이미지 로드 실패:", error);
  }
};

// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 스페이스바 누름 상태

// 스페이스바 눌렀을 때 추적 시작
document.addEventListener("pointerdown", (event) => {
  isTracking = true;
  positions = []; // 이전 데이터 초기화
  lastIndex = 0;
});

// 마우스 움직임 기록
document.addEventListener("mousemove", (event) => {
  if (isTracking) {
    const { clientX, clientY } = event;
    let width = canvas.width;
    let height = canvas.height;

    // 현재 좌표를 배열에 저장
    positions.push({ x: clientX, y: clientY });

    if (positions.length < 2) {
      return;
    }

    lastIndex = positions.length - 1;
    const start = positions[lastIndex - 1];
    const end = positions[lastIndex];

    
    let linePoints = getLinePoints(start.x,start.y, end.x,end.y);
    gpuApplyPixelFlowLine(linePoints);

    // 선분의 시작과 끝 점으로 bounding box 계산
    const boundMinX = Math.max(0, Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS));
    const boundMinY = Math.max(0, Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS));
    const boundMaxX = Math.min(width - 1, Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS));
    const boundMaxY = Math.min(height - 1, Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS));

    // CPU 렌더링: displacement를 반영하여 원본 이미지를 다시 그리기
    renderToImage(canvas, boundMinX, boundMinY, boundMaxX, boundMaxY);
  }
});

// 스페이스바 뗐을 때 추적 종료 및 로그 출력
document.addEventListener("pointerup", (event) => {
  isTracking = false;
  console.log("Tracking 종료. 기록된 좌표:");
});

const helper_canvas = document.getElementById("helper-canvas");
const helper_ctx = canvas.getContext("2d");

function drawHelperLine(ctx, points) {
  if (!Array.isArray(points) || points.length < 2) {
    console.warn("At least two points are required to draw helper lines.");
    return;
  }

  const totalPoints = points.length;

  // Function to interpolate color from red to blue
  const getColor = (index) => {
    const ratio = index / (totalPoints - 1); // Ratio between 0 and 1
    const r = Math.round(255 * (1 - ratio)); // Red decreases
    const g = 0; // Green remains 0
    const b = Math.round(255 * ratio); // Blue increases
    return `rgba(${r},${g},${b},0.05)`;
  };

  // Draw lines between consecutive points
  for (let i = 0; i < totalPoints - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    ctx.beginPath(); // Start a new path
    ctx.moveTo(start.x, start.y); // Move to the start point
    ctx.lineTo(end.x, end.y); // Draw a line to the end point
    ctx.lineWidth = 1; // Set line width
    ctx.strokeStyle = "rgba(0,255,0,0.05)"; // Set line color to blue
    ctx.stroke(); // Render the line
  }

  // Draw circles at each point with colors transitioning from red to blue
  for (let i = 0; i < totalPoints; i++) {
    const point = points[i];
    const color = getColor(i); // Get the color based on point index

    ctx.fillStyle = color; // Set fill color
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2); // Draw a circle with radius 2
    ctx.fill();
  }
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
  helper_canvas.width = canvas.width;
  helper_canvas.height = canvas.height;
  ctx.drawImage(img, 0, 0);
}


// Bresenham 알고리즘: 두 점 사이 모든 정수 좌표를 구합니다.
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


// WebGL2 관련 전역 변수
let webglCanvas, gl;
let width, height;
let glProgram, glVao;
let texIn, texOut;
let fboIn, fboOut;

// 최대 선분 점 개수 (Uniform로 넘길 최대 개수)
const MAX_LINE_POINTS = 256;

// ================== WebGL2 초기화 ==================
async function initWebGL2(offscreenCanvas) {
  // OffscreenCanvas로부터 WebGL2 context
  gl = offscreenCanvas.getContext("webgl2", { antialias: false });
  if(!gl){
    throw new Error("WebGL2 not supported in OffscreenCanvas.");
  }
  // float 텍스처 확장
  const ext = gl.getExtension("EXT_color_buffer_float");
  if(!ext){
    throw new Error("EXT_color_buffer_float not supported.");
  }

  gl.viewport(0,0, width, height);
  gl.clearColor(0,0,0,1);

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

  let quad = new Float32Array([-1,-1, +1,-1, -1,+1, +1,+1]);
  let vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

  gl.bindVertexArray(null);

  // 텍스처 & FBO 2개 (ping-pong)
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
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, tex,0
    );
    return fbo;
  }
}

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
  let p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
    throw new Error("Program link error:\n"+gl.getProgramInfoLog(p));
  }
  return p;
}

// ================== CPU <-> GPU 동기화 ==================
function uploadDisplaceToTex(displaceX, displaceY, tex){
  let size = width*height*2;
  let buf = new Float32Array(size);
  for(let i=0; i<width*height; i++){
    buf[i*2+0] = displaceX[i];
    buf[i*2+1] = displaceY[i];
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(
    gl.TEXTURE_2D, 0, 0,0, width, height,
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

// ================== GPU applyPixelFlow: 전체 linePoints를 한 번에 처리 ==================
function gpuApplyPixelFlowLine(linePoints){
 // console.log(linePoints)
  // 1) CPU->GPU: displace -> texIn
  uploadDisplaceToTex(displaceX, displaceY, texIn);

  // 2) draw call (fboOut)
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
  for(let i=0; i<n; i++){
    let pointLoc = gl.getUniformLocation(glProgram, `uLinePoints[${i}]`);
    gl.uniform2f(pointLoc, linePoints[i].x, linePoints[i].y);
  }

  // uEnd: linePoints의 마지막
  let endPt = linePoints[linePoints.length-1];
  loc = gl.getUniformLocation(glProgram, "uEnd");
  gl.uniform2f(loc, endPt.x, endPt.y);

  // bounding box
  let boundMinX=Infinity, boundMinY=Infinity;
  let boundMaxX=-Infinity, boundMaxY=-Infinity;
  for(let i=0;i<linePoints.length;i++){
    let px=linePoints[i].x, py=linePoints[i].y;
    if(px<boundMinX) boundMinX=px;
    if(px>boundMaxX) boundMaxX=px;
    if(py<boundMinY) boundMinY=py;
    if(py>boundMaxY) boundMaxY=py;
  }
  // 반경 고려
  boundMinX = Math.floor(boundMinX - EFFECT_RADIUS);
  boundMinY = Math.floor(boundMinY - EFFECT_RADIUS);
  boundMaxX = Math.ceil(boundMaxX + EFFECT_RADIUS);
  boundMaxY = Math.ceil(boundMaxY + EFFECT_RADIUS);

  // clamp
  boundMinX = Math.max(0, boundMinX);
  boundMinY = Math.max(0, boundMinY);
  boundMaxX = Math.min(width-1, boundMaxX);
  boundMaxY = Math.min(height-1,boundMaxY);

  loc = gl.getUniformLocation(glProgram,"uBounds");
  // (minX, minY, maxX, maxY)
  gl.uniform4f(loc, boundMinX, boundMinY, boundMaxX, boundMaxY);

  // 풀스크린 드로우
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);

  // 3) GPU->CPU
  downloadTexToDisplace(texOut, fboOut, displaceX, displaceY);
}