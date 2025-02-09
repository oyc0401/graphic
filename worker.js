// worker.js
import { Liquify } from "./liquify";

let canvas, ctx;
const EFFECT_RADIUS = 500; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

// 마우스(포인터) 좌표 기록 변수
let positions = [];
let isTracking = false;
let lastIndex = 0;
let distance = 0;

let liquify;
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

      liquify = new Liquify(canvas, ctx);
      liquify.setRadius(EFFECT_RADIUS);
      liquify.setStrength(MAGNIFY_STRENGTH);
    } catch (err) {
      console.error("이미지 로드 실패:", err);
    }
  } else if (data.type === "pointerdown") {
    isTracking = true;
    positions = []; // 이전 데이터 초기화
    lastIndex = 0;
    distance = 0;
    
  } else if (data.type === "pointermove") {
    if (!isTracking) return;
    const { x, y } = data;
    positions.push({ x, y });
    if (positions.length < 2) {
      return;
    }
    execute();
    
  } else if (data.type === "pointerup") {
    isTracking = false;
    console.log("Tracking 종료. 기록된 좌표:");
    
  }
};

// // Bresenham 알고리즘을 사용하여 두 점 사이의 모든 정수 좌표를 구하는 함수
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

function goLiquify(start, end) {
    let tap = Math.ceil(liquify.radius / 20);
    const linePoints = getLinePoints(start.x, start.y, end.x, end.y);
    linePoints.forEach((point) => {
        if (distance % tap == 0) {
            liquify.applyPixelFlow(point, end, tap);
        }
        distance++;
    });
}

let queued = false;
function execute() {
    if (!queued) {
        queued = true;
        requestAnimationFrame(() => {
            // 렌더링 영역 계산
            let minX = Infinity;
            let minY = Infinity;
            let maxX = 0;
            let maxY = 0;

            if (lastIndex == positions.length - 1) {
                queued = false;
                console.warn("왜 여기 들어왔니");
                return;
            }

            while (lastIndex < positions.length - 1) {
                const start = positions[lastIndex];
                const end = positions[lastIndex + 1];
                goLiquify(start, end);
                lastIndex++;

                minX = Math.min(start.x, end.x, minX);
                minY = Math.min(start.y, end.y, minY);
                maxX = Math.max(start.x, end.x, maxX);
                maxY = Math.max(start.y, end.y, maxY);
            }

            liquify.renderToImage(minX, minY, maxX, maxY);

            queued = false;
        });
    }
}

