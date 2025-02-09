import { Liquify } from "./liquify";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let liquify;

const EFFECT_RADIUS = 50; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1;

// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 누름 상태
let distance = 0;
let lastIndex = 0;

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

// 초기화
window.onload = async () => {
    try {
        //const img = await loadImageFromURL("check.png");
        const img = await loadImageFromURL("cat.webp");
        //const img = await loadImageFromURL("musk.png");
        drawImageToCanvas(img);

        liquify = new Liquify(canvas, ctx);
        liquify.setRadius(EFFECT_RADIUS);
        liquify.setStrength(MAGNIFY_STRENGTH);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
};

document.addEventListener("pointerdown", (event) => {
    isTracking = true;
    positions = []; // 이전 데이터 초기화
    lastIndex = 0;
    distance = 0;
});

document.addEventListener("pointermove", (event) => {
    //return;
    if (!isTracking) {
        return;
    }

    const { clientX, clientY } = event;

    // 현재 좌표를 배열에 저장
    positions.push({ x: ~~clientX, y: ~~clientY });

    if (positions.length < 2) {
        return;
    }

    lastIndex = positions.length - 1;
    const start = positions[lastIndex - 1];
    const end = positions[lastIndex];

    goLiquify(start, end);

    // 렌더링 영역 계산
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);

    liquify.renderToImage(minX, minY, maxX, maxY);

    //renderToImage( 0, 0, c_width, c_height);
});

document.addEventListener("pointerup", (event) => {
    isTracking = false;
    console.log("pointerup");
    //renderToImage( 0, 0, c_width, c_height);
});

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
