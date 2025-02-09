// 설정값
import { Liquify } from "./liquify";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function renderToImage(sx, sy, ex, ey) {
    const width = ex - sx + 1; // 시작: 5, 끝: 9이면 5 6 7 8 9, 총 길이 5임
    const height = ey - sy + 1;
    let c_width = liquify.c_width;
    let c_height = liquify.c_height;

    // 잘못된 영역이면 그냥 종료합니다.
    if (width <= 0 || height <= 0) {
        return;
    }

    const newImageData = new Uint8ClampedArray(width * height * 4);

    let imageIndex = 0;
    for (let y = sy; y <= ey; y++) {
        for (let x = sx; x <= ex; x++) {
            const index = y * c_width + x;

            const totalDx = liquify.displaceMap[2 * index];
            const totalDy = liquify.displaceMap[2 * index + 1];
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
                const clampedX = clamp(xx, 0, c_width - 1);
                const clampedY = clamp(yy, 0, c_height - 1);
                const idx = (clampedY * c_width + clampedX) * 4;
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
                    liquify.originalData[idx],
                    liquify.originalData[idx + 1],
                    liquify.originalData[idx + 2],
                    liquify.originalData[idx + 3],
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

// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 누름 상태
let count = 0;
let lastIndex = 0;

let liquify;

// 초기화
window.onload = async () => {
    try {
        //const img = await loadImageFromURL("check.png");
        const img = await loadImageFromURL("cat.webp");
        //const img = await loadImageFromURL("musk.png");
        drawImageToCanvas(img);

        liquify = new Liquify(canvas, ctx);
        liquify.setRadius(50);
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

    //ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
    //let area = createEffectArea(EFFECT_RADIUS);

    let tap = Math.ceil(liquify.EFFECT_RADIUS / 20);
    const linePoints = getLinePoints(start.x, start.y, end.x, end.y);
    linePoints.forEach((point) => {
        // ctx.beginPath();
        // ctx.arc(point.x, point.y, EFFECT_RADIUS, 0, Math.PI * 2);
        // ctx.fill();
        if (count % tap == 0) {
            // console.log("tap", tap);
            //applyPixelFlow(point, end, area, tap);
            liquify.applyPixelFlow(point, end, tap);
        }
        count++;
    });

    // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
    let ceiledRadius = Math.ceil(liquify.EFFECT_RADIUS);
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
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
