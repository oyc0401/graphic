let canvas, ctx;
const EFFECT_RADIUS = 100; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

let lastIndex = 0;
let displaceX;
let displaceY;
let originalImageData;
let originalData;
let isTracking = false;

// main.js
(() => {
  window.addEventListener("load", () => {
    const canvas = document.getElementById("canvas");
    // 캔버스 크기를 원하는 대로 지정합니다.
    canvas.width = 800;
    canvas.height = 600;

    // OffscreenCanvas로 전환 (transferControlToOffscreen)
    const offscreen = canvas.transferControlToOffscreen();

    // 웹워커 생성
    const worker = new Worker("worker.js");

    // 웹워커 초기화 메시지 전송 (OffscreenCanvas와 이미지 URL 전달)
    worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        imageUrl: "check_r.png" // 실제 사용하실 이미지 경로로 수정하세요.
      },
      [offscreen]
    );

    // 캔버스 내 좌표를 얻기 위한 헬퍼 함수 (캔버스의 위치에 따라 보정)
    const getCanvasCoordinates = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor(event.clientX - rect.left),
        y: Math.floor(event.clientY - rect.top)
      };
    };

    // pointer 이벤트를 웹워커로 전달합니다.
    document.addEventListener("pointerdown", (event) => {
      const pos = getCanvasCoordinates(event);
        isTracking = true;
        positions = [];
        positions.push({ x: pos.x, y: pos.y });
        lastIndex = 0;
    });

    document.addEventListener("pointermove", (event) => {
        const pos = getCanvasCoordinates(event);
        if (!isTracking) return;
        positions.push({ x: pos.x, y: pos.y });
        if (positions.length < 2) return;
        sum = 0;
        lastIndex = positions.length - 1;
        const start = positions[lastIndex - 1];
        const end = positions[lastIndex];

        const linePoints = getLinePoints(start.x, start.y, end.x, end.y);


          worker.postMessage({ type: "applyLine", linePoints });
    });

    document.addEventListener("pointerup", (event) => {
      
        isTracking = false;
    });
  });
})();


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


