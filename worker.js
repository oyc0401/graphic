// worker.js
// 웹워커에서는 OffscreenCanvas를 통해 이미지를 로드하고
// 픽셀 플로우 효과를 적용하여 드로잉 작업을 수행합니다.

let canvas, ctx;
let originalImageData, originalData;
let displaceX, displaceY;

const EFFECT_RADIUS = 50; // 효과 반경
const MAGNIFY_STRENGTH = 1; // 효과 강도

// 마우스 좌표 기록 관련 변수
let positions = [];
let isTracking = false;

// 초기 이미지 데이터를 생성하고 변위 맵을 초기화
function initPixelFlow() {
  const width = canvas.width;
  const height = canvas.height;
  originalImageData = ctx.getImageData(0, 0, width, height);
  originalData = originalImageData.data;
  displaceX = new Float32Array(width * height);
  displaceY = new Float32Array(width * height);
}

// easing 함수
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// 픽셀 플로우 효과 적용 함수
function applyPixelFlow(canvas, start, end) {
    const width = canvas.width;
    const height = canvas.height;

    // end는 방향 계산용으로만 사용
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return;
    const unitX = dx / length;
    const unitY = dy / length;

    // start를 중심으로 EFFECT_RADIUS 반경 내의 픽셀만 처리하기 위한 바운딩 박스 계산
    const boundMinX = Math.max(0, Math.floor(start.x - EFFECT_RADIUS));
    const boundMaxX = Math.min(width - 1, Math.ceil(start.x + EFFECT_RADIUS));
    const boundMinY = Math.max(0, Math.floor(start.y - EFFECT_RADIUS));
    const boundMaxY = Math.min(height - 1, Math.ceil(start.y + EFFECT_RADIUS));

    // unit 방향에 따라 for문 시작점, 끝점, step 결정
    // x축
    let xStart, xEnd, stepX;
    if (unitX > 0) {
        // unitX가 양수이면 x는 큰 값에서 작은 값으로 감소
        xStart = boundMaxX;
        xEnd = boundMinX;
        stepX = -1;
    } else {
        // unitX가 0이거나 음수이면 x는 작은 값에서 큰 값으로 증가
        xStart = boundMinX;
        xEnd = boundMaxX;
        stepX = 1;
    }

    let yStart, yEnd, stepY;
    if (unitY > 0) {
        // unitY가 양수이면 y는 큰 값에서 작은 값으로 감소
        yStart = boundMaxY;
        yEnd = boundMinY;
        stepY = -1;
    } else {
        // unitY가 0이거나 음수이면 y는 작은 값에서 큰 값으로 증가
        yStart = boundMinY;
        yEnd = boundMaxY;
        stepY = 1;
    }

    // y축 반복: stepY에 따라 조건 변경
    for (let y = yStart; stepY > 0 ? y <= yEnd : y >= yEnd; y += stepY) {
        // x축 반복: stepX에 따라 조건 변경
        for (let x = xStart; stepX > 0 ? x <= xEnd : x >= xEnd; x += stepX) {
            const index = y * width + x;
            const currentX = x;
            const currentY = y;

            // start와 현재 픽셀 사이의 거리 계산
            const deltaX = currentX - start.x;
            const deltaY = currentY - start.y;
            const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // 원 내부의 픽셀만 처리
            if (dist < EFFECT_RADIUS) {
                // 원래 코드에서 4방향(좌/우, 위/아래) 미분 차이를 계산하는 부분

                let diffL = { x: 0, y: 0, t: 0 },
                    diffR = { x: 0, y: 0 },
                    diffT = { x: 0, y: 0 },
                    diffB = { x: 0, y: 0 };

                // -> 방향으로 밀때
                const leftIdx = y * width + (x - 1);
                let leftDisplaceX = x > 0 ? displaceX[leftIdx] : 0;
                let leftDisplaceY = x > 0 ? displaceY[leftIdx] : 0;

                diffL.x = displaceX[index] + 1 - leftDisplaceX;
                diffL.y = displaceY[index] - leftDisplaceY;

                // <- 방향으로 밀때
                const rightIdx = y * width + (x + 1);
                let rightDisplaceX = x < width - 1 ? displaceX[rightIdx] : 0;
                let rightDisplaceY = x < width - 1 ? displaceY[rightIdx] : 0;

                diffR.x = rightDisplaceX + 1 - displaceX[index];
                diffR.y = rightDisplaceY - displaceY[index];

                // 아래로 밀때
                const topIdx = (y - 1) * width + x;
                let topDisplaceX = y > 0 ? displaceX[topIdx] : 0;
                let topDisplaceY = y > 0 ? displaceY[topIdx] : 0;

                diffT.x = displaceX[index] - topDisplaceX;
                diffT.y = displaceY[index] + 1 - topDisplaceY;

                // 위로 밀때
                const bottomIdx = (y + 1) * width + x;
                let bottomDisplaceX = y < height - 1 ? displaceX[bottomIdx] : 0;
                let bottomDisplaceY = y < height - 1 ? displaceY[bottomIdx] : 0;

                diffB.x = bottomDisplaceX - displaceX[index];
                diffB.y = bottomDisplaceY + 1 - displaceY[index];

                // unit 방향에 따른 미분 선택
                let diffX = unitX > 0 ? diffL : diffR;
                let diffY = unitY > 0 ? diffT : diffB;

                // easing 함수 (예시로 easeInOutCubic 사용)
                const easeInOutCubic = (x) =>
                    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

                // start와의 거리에 따른 효과 강도 계산
                const effectFactor =
                    ((1 - easeInOutCubic(dist / EFFECT_RADIUS)) *
                        MAGNIFY_STRENGTH)

                // offset 계산 (두 방향 간의 보정도 포함)
                const offsetX = diffX.x / Math.pow(2, effectFactor) - diffX.x;
                const offsetY = diffY.y / Math.pow(2, effectFactor) - diffY.y;

                const offsetX2Y = diffX.y / Math.pow(2, effectFactor) - diffX.y;

                const offsetY2X = diffY.x / Math.pow(2, effectFactor) - diffY.x;

                // 누적 변위 업데이트 (smallerAbs 함수는 두 값 중 절대값이 작은 쪽을 선택)
                displaceX[index] += offsetX * unitX;
                displaceY[index] += offsetX2Y * unitX;

                displaceY[index] += offsetY * unitY;
                displaceX[index] += offsetY2X * unitY;

                sum++;
            }
        }
    }

    // console.log("sum:", sum);
}

// 양선형 보간을 이용해 변형된 이미지를 그리는 함수
function renderToImage(sx, sy, ex, ey) {
  const canvas_w = canvas.width;
  const canvas_h = canvas.height;
  const width = ex - sx;
  const height = ey - sy;
  if (width <= 0 || height <= 0) return;

  const newImageDataArray = new Uint8ClampedArray(width * height * 4);
  let imageIndex = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const index = y * canvas_w + x;
      const totalDx = displaceX[index];
      const totalDy = displaceY[index];
      let newX = x + totalDx;
      let newY = y + totalDy;

      // 양선형 보간 준비
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
      const newIndex = imageIndex * 4;
      newImageDataArray[newIndex] = r;
      newImageDataArray[newIndex + 1] = g;
      newImageDataArray[newIndex + 2] = b;
      newImageDataArray[newIndex + 3] = a;
      imageIndex++;
    }
  }

  const newImageData = new ImageData(newImageDataArray, width, height);
  ctx.putImageData(newImageData, sx, sy);
}

// Bresenham 알고리즘을 사용하여 두 점 사이의 모든 정수 좌표를 구합니다.
function getLinePoints(x0, y0, x1, y1) {

  
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

// 메시지 핸들러
onmessage = async function (e) {
  const data = e.data;
  if (data.type === "init") {
    // OffscreenCanvas와 이미지 URL 받기
    canvas = data.canvas;
    ctx = canvas.getContext("2d");

    // 이미지 로드: fetch()와 createImageBitmap() 사용 (웹워커 환경에서 가능)
    try {
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);

      // 캔버스 크기를 이미지 크기에 맞춤
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      ctx.drawImage(imgBitmap, 0, 0);

      // 원본 이미지 데이터와 변위 맵 초기화
      initPixelFlow();
    } catch (err) {
      console.error("이미지 로드 실패:", err);
    }
  } else if (data.type === "pointerdown") {
    isTracking = true;
    positions = [];
    positions.push({ x: data.x, y: data.y });
  } else if (data.type === "pointermove") {
    if (!isTracking) return;
    positions.push({ x: data.x, y: data.y });
    if (positions.length < 2) return;
    const lastIndex = positions.length - 1;
    const start = positions[lastIndex - 1];
    const end = positions[lastIndex];
    const linePoints = getLinePoints(~~start.x, ~~start.y, ~~end.x, ~~end.y);
    for (const point of linePoints) {
      applyPixelFlow(point, end);
    }

    // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려하여 바운딩 박스 계산
    const boundMinX = Math.max(0, Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS));
    const boundMinY = Math.max(0, Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS));
    const boundMaxX = Math.min(canvas.width - 1, Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS));
    const boundMaxY = Math.min(canvas.height - 1, Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS));

    renderToImage(boundMinX, boundMinY, boundMaxX, boundMaxY);

    console.log('nove!')
  } else if (data.type === "pointerup") {
    isTracking = false;
  }
};
