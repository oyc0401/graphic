// worker.js

let canvas, ctx;
const EFFECT_RADIUS = 100; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

let lastIndex = 0;
let displaceX;
let displaceY;
let originalImageData;
let originalData;

// 기존 initPixelFlow() 함수: 원본 이미지 데이터와 변위 맵 초기화
function initPixelFlow(canvas, ctx) {
  const width = canvas.width;
  const height = canvas.height;

  try {
    originalImageData = ctx.getImageData(0, 0, width, height);
  } catch (err) {
    console.error("getImageData 실패:", err);
  }
  originalData = originalImageData.data;

  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

// easing 함수 (easeInOutCubic)
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

let sum = 0;
// 원래 로직 그대로의 applyPixelFlow 함수
function applyPixelFlow(start, end) {
  const width = canvas.width;
  const height = canvas.height;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;
  const unitX = dx / length;
  const unitY = dy / length;

  const boundMinX = Math.max(0, Math.floor(start.x - EFFECT_RADIUS));
  const boundMaxX = Math.min(width - 1, Math.ceil(start.x + EFFECT_RADIUS));
  const boundMinY = Math.max(0, Math.floor(start.y - EFFECT_RADIUS));
  const boundMaxY = Math.min(height - 1, Math.ceil(start.y + EFFECT_RADIUS));

  let xStart, xEnd, stepX;
  if (unitX > 0) {
    xStart = boundMaxX;
    xEnd = boundMinX;
    stepX = -1;
  } else {
    xStart = boundMinX;
    xEnd = boundMaxX;
    stepX = 1;
  }

  let yStart, yEnd, stepY;
  if (unitY > 0) {
    yStart = boundMaxY;
    yEnd = boundMinY;
    stepY = -1;
  } else {
    yStart = boundMinY;
    yEnd = boundMaxY;
    stepY = 1;
  }

  for (let y = yStart; stepY > 0 ? y <= yEnd : y >= yEnd; y += stepY) {
    for (let x = xStart; stepX > 0 ? x <= xEnd : x >= xEnd; x += stepX) {
      const index = y * width + x;
      const currentX = x;
      const currentY = y;

      const deltaX = currentX - start.x;
      const deltaY = currentY - start.y;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (dist < EFFECT_RADIUS) {
        let diffL = { x: 0, y: 0 },
          diffR = { x: 0, y: 0 },
          diffT = { x: 0, y: 0 },
          diffB = { x: 0, y: 0 };

        // 좌측 픽셀 차분
        const leftIdx = y * width + (x - 1);
        let leftDisplaceX = x > 0 ? displaceX[leftIdx] : 0;
        let leftDisplaceY = x > 0 ? displaceY[leftIdx] : 0;
        diffL.x = displaceX[index] + 1 - leftDisplaceX;
        diffL.y = displaceY[index] - leftDisplaceY;

        // 우측 픽셀 차분
        const rightIdx = y * width + (x + 1);
        let rightDisplaceX = x < width - 1 ? displaceX[rightIdx] : 0;
        let rightDisplaceY = x < width - 1 ? displaceY[rightIdx] : 0;
        diffR.x = rightDisplaceX + 1 - displaceX[index];
        diffR.y = rightDisplaceY - displaceY[index];

        // 위쪽 픽셀 차분
        const topIdx = (y - 1) * width + x;
        let topDisplaceX = y > 0 ? displaceX[topIdx] : 0;
        let topDisplaceY = y > 0 ? displaceY[topIdx] : 0;
        diffT.x = displaceX[index] - topDisplaceX;
        diffT.y = displaceY[index] + 1 - topDisplaceY;

        // 아래쪽 픽셀 차분
        const bottomIdx = (y + 1) * width + x;
        let bottomDisplaceX = y < height - 1 ? displaceX[bottomIdx] : 0;
        let bottomDisplaceY = y < height - 1 ? displaceY[bottomIdx] : 0;
        diffB.x = bottomDisplaceX - displaceX[index];
        diffB.y = bottomDisplaceY + 1 - displaceY[index];

        // unit 방향에 따른 미분 선택
        let diffX = unitX > 0 ? diffL : diffR;
        let diffY = unitY > 0 ? diffT : diffB;

        const effectFactor =
          (1 - easeInOutCubic(dist / EFFECT_RADIUS)) * MAGNIFY_STRENGTH;

        const offsetX = diffX.x / Math.pow(2, effectFactor) - diffX.x;
        const offsetY = diffY.y / Math.pow(2, effectFactor) - diffY.y;

        const offsetX2Y = diffX.y / Math.pow(2, effectFactor) - diffX.y;
        const offsetY2X = diffY.x / Math.pow(2, effectFactor) - diffY.x;

        displaceX[index] += offsetX * unitX;
        displaceY[index] += offsetX2Y * unitX;

        displaceY[index] += offsetY * unitY;
        displaceX[index] += offsetY2X * unitY;

        sum++;
      }
    }
  }
}

// 원본 로직 그대로의 renderToImage 함수 (양선형 보간)
function renderToImage(sx, sy, ex, ey) {
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;

  const width = ex - sx;
  const height = ey - sy;

  if (width <= 0 || height <= 0) {
    return;
  }

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

const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

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

// 마우스(포인터) 좌표 기록 변수
let positions = [];
let isTracking = false;

// 웹워커 메시지 핸들러 (원래 코드 로직을 그대로 유지)
onmessage = async function (e) {
  const data = e.data;
  if (data.type === "init") {
    // OffscreenCanvas와 이미지 URL을 받습니다.
    canvas = data.canvas;
    ctx = canvas.getContext("2d");

    try {
      // 웹워커에서는 fetch()와 createImageBitmap()으로 이미지 로드
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);

      // 캔버스 크기를 이미지 크기에 맞춥니다.
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      ctx.drawImage(imgBitmap, 0, 0);

      // 원본 이미지 데이터와 변위 맵 초기화
      initPixelFlow(canvas, ctx);
    } catch (err) {
      console.error("이미지 로드 실패:", err);
    }
  } else if (data.type === "pointerdown") {
    isTracking = true;
    positions = [];
    positions.push({ x: data.x, y: data.y });
    lastIndex = 0;
  } else if (data.type === "pointermove") {
    if (!isTracking) return;
    positions.push({ x: data.x, y: data.y });
    if (positions.length < 2) return;
    sum = 0;
    lastIndex = positions.length - 1;
    const start = positions[lastIndex - 1];
    const end = positions[lastIndex];

    const linePoints = getLinePoints(start.x, start.y, end.x, end.y);
    
    linePoints.forEach((point) => {
      applyPixelFlow(point, end);
    });

    const boundMinX = Math.max(
      0,
      Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS)
    );
    const boundMinY = Math.max(
      0,
      Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS)
    );
    const boundMaxX = Math.min(
      canvas.width - 1,
      Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS)
    );
    const boundMaxY = Math.min(
      canvas.height - 1,
      Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS)
    );
    renderToImage(boundMinX, boundMinY, boundMaxX, boundMaxY);
  } else if (data.type === "pointerup") {
    isTracking = false;
    console.log("Tracking 종료. 기록된 좌표:");
  }
};

