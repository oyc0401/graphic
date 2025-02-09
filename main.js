// 설정값
import { Liquify } from "./liquify";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let liquify;

const EFFECT_RADIUS = 500; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1;

// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 누름 상태
let count = 0;
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
    count = 0;
    //const { clientX, clientY } = event;
    // applyPixelFlow(
    //     canvas,
    //     { x: ~~clientX, y: ~~clientY },
    //     { x: ~~clientX + 100, y: ~~clientY + 100 },
    // );

    //renderToImage( 0, 0, c_width, c_height);

    // let index = ~~clientY * c_width + ~~clientX;

    // console.log(
    //     `(${~~clientX}, ${~~clientY})`,
    //     ",",
    //     displaceX[index],
    //     displaceY[index],
    // );
    //console.table(createEffectArea(5));
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

    let tap = Math.ceil(EFFECT_RADIUS / 20);
    const linePoints = getLinePoints(start.x, start.y, end.x, end.y);
    linePoints.forEach((point) => {
        if (count % tap == 0) {
            liquify.applyPixelFlow(point, end, tap);
        }
        count++;
    });

    // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
    let ceiledRadius = Math.ceil(EFFECT_RADIUS);
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);0
    const boundMinX = Math.max(0, minX - ceiledRadius);
    const boundMinY = Math.max(0, minY - ceiledRadius);
    const boundMaxX = Math.min(liquify.c_width - 1, maxX + ceiledRadius);
    const boundMaxY = Math.min(liquify.c_height - 1, maxY + ceiledRadius);

    liquify.renderToImage(boundMinX, boundMinY, boundMaxX, boundMaxY);

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
