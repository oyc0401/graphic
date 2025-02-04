// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 50; // 뒤틀기 효과 반경
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

const easeInOutCubic = (x) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let sum = 0;
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
                    (1 - easeInOutCubic(dist / EFFECT_RADIUS)) *
                    MAGNIFY_STRENGTH;

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

function renderToImage(canvas, sx, sy, ex, ey) {
    const canvas_w = canvas.width;
    const canvas_h = canvas.height;

    const width = ex - sx;
    const height = ey - sy;

    // 잘못된 영역이면 그냥 종료합니다.
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

function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}
function applyLine(start, end, radius) {
    const step = radius;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const totalDistance = Math.hypot(dx, dy);
    const steps = Math.floor(totalDistance / step);
    const remainder = totalDistance % step; // 남은 부분 계산

    if (remainder > 0) {
        const firstEnd = {
            x: start.x + (dx * remainder) / totalDistance,
            y: start.y + (dy * remainder) / totalDistance,
        };
        getLinePoints(start.x, start.y, firstEnd.x, firstEnd.y).forEach(
            (point) => {
                applyPixelFlow(canvas, point, firstEnd);
            },
        );
    }

    for (let i = 0; i < steps; i++) {
        const t1 = (remainder + i * step) / totalDistance;
        const t2 = (remainder + (i + 1) * step) / totalDistance;

        const p1 = {
            x: start.x + dx * t1,
            y: start.y + dy * t1,
        };
        const p2 = {
            x: start.x + dx * t2,
            y: start.y + dy * t2,
        };

        applyPixelFlowLine(canvas, p1, p2, 18);
    }
}

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check_r.png");
        // const img = await loadImageFromURL("cat.webp");
        //const img = await loadImageFromURL("musk.png");
        drawImageToCanvas(img);

        initPixelFlow(canvas, ctx);
        // getLinePoints(100, 100, 200, 100).forEach((point) => {
        //     applyPixelFlow(canvas, point, { x: 400, y: 100 });
        // });
        let radius = EFFECT_RADIUS;
        let start = { x: 100, y: 100 };
        let end = { x: 400, y: 100 };

        // applyLine(start, end, radius);

        let F = 1.32
        applyPixelFlowLine(canvas, { x: 100, y: 100 }, { x: 150, y: 100 },F );
        applyPixelFlowLine(canvas, { x: 150, y: 100 }, { x: 200, y: 100 }, F );
       applyPixelFlowLine(canvas, { x: 200, y: 100 }, { x: 250, y: 100 }, F );
        applyPixelFlowLine(canvas, { x: 250, y: 100 }, { x: 300, y: 100 }, F );
        applyPixelFlowLine(canvas, { x: 300, y: 100 }, { x: 350, y: 100 }, F );
        applyPixelFlowLine(canvas, { x: 350, y: 100 }, { x: 400, y: 100 }, F );
        // getLinePoints(400, 100, 450, 100).forEach((point) => {
        //     applyPixelFlow(canvas, point, { x: 450, y: 100 });
        // });
        // applyPixelFlowLine(canvas, { x: 100, y: 100 }, { x: 400, y: 100 });

        // applyPixelFlowLine(canvas, { x: 100, y: 300 }, { x: 400, y: 300 }, 2);

        getLinePoints(100, 300, 200, 300).forEach((point) => {
            applyPixelFlow(canvas, point, { x: 200, y: 300 });
        });

        getLinePoints(200, 300, 400, 300).forEach((point) => {
            applyPixelFlow(canvas, point, { x: 400, y: 300 });
        });

        renderToImage(canvas, 0, 0, canvas.width, canvas.height);
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
// 마우스 움직임 기록
document.addEventListener("pointermove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;
        let width = canvas.width;
        let height = canvas.height;

        // 현재 좌표를 배열에 저장
        positions.push({ x: ~~clientX, y: ~~clientY });

        if (positions.length < 2) {
            return;
        }

        sum = 0;
        lastIndex = positions.length - 1;
        const start = positions[lastIndex - 1];
        const end = positions[lastIndex];

        //ctx.fillStyle = "rgba(255, 0, 0, 0.1)";

        const linePoints = getLinePoints(start.x, start.y, end.x, end.y);
        linePoints.forEach((point) => {
            // ctx.beginPath();
            // ctx.arc(point.x, point.y, EFFECT_RADIUS, 0, Math.PI * 2);
            // ctx.fill();
            applyPixelFlow(canvas, point, end);
        });

        // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
        const boundMinX = Math.max(
            0,
            Math.floor(Math.min(start.x, end.x) - EFFECT_RADIUS),
        );
        const boundMinY = Math.max(
            0,
            Math.floor(Math.min(start.y, end.y) - EFFECT_RADIUS),
        );

        const boundMaxX = Math.min(
            width - 1,
            Math.ceil(Math.max(start.x, end.x) + EFFECT_RADIUS),
        );

        const boundMaxY = Math.min(
            height - 1,
            Math.ceil(Math.max(start.y, end.y) + EFFECT_RADIUS),
        );

        //console.log(sum);
        //console.log(boundMinX, boundMinY, boundMaxX, boundMaxY);
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

function applyPixelFlowLine(canvas, start, end, force = 1) {
    const width = canvas.width;
    const height = canvas.height;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return;
    const unitX = dx / length;
    const unitY = dy / length;

    // 선분의 최소/ ��대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
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

    const gridWidth = boundMaxX - boundMinX;
    const gridHeight = boundMaxY - boundMinY;

    console.log(start, end);
    console.log(gridWidth, gridHeight);
    console.log(boundMinX, boundMaxX, boundMinY, boundMaxY);
    console.log(
        start.x - boundMinX,
        start.y - boundMinY,
        gridWidth - EFFECT_RADIUS,
        gridHeight - EFFECT_RADIUS,
    );

    const centers = bresenhamLine(
        start.x - boundMinX,
        start.y - boundMinY,
        gridWidth - EFFECT_RADIUS,
        gridHeight - EFFECT_RADIUS,
    );

    // 차분 배열 업데이트를 통해 최종 결과 배열 생성
    const capsuleGrid = generateResultGrid(
        gridWidth,
        gridHeight,
        EFFECT_RADIUS,
        centers,
    );

    console.log(capsuleGrid);

    let halfRadius = Math.floor(0);

    console.log("반복문", xStart, yStart, ", ", xEnd, yEnd);
    console.log("그리드 width:", gridWidth, "height:", gridHeight);
    console.log("반복문 width:", xEnd - xStart, "height:", yEnd - yStart);
    // y 반복: 조건은 stepY의 부호에 따라 달라짐
    for (let y = yStart; stepY > 0 ? y <= yEnd : y >= yEnd; y += stepY) {
        // x 반복: 조건은 stepX의 부호에 따라 달라짐
        for (let x = xStart; stepX > 0 ? x <= xEnd : x >= xEnd; x += stepX) {
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

                // x, y 각각에 대해 해당 방향의 차이를 선택
                diffX = unitX > 0 ? diffL : diffR;
                diffY = unitY > 0 ? diffT : diffB;

                // easing 함수
                const easeInOutCubic = (x) =>
                    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
                function easeInOutSine(x) {
                    return -(Math.cos(Math.PI * x) - 1) / 2;
                }
                const easeInOutCubicModified = (x) => {
                    if (x < 0.5) {
                        return 4 * x * x * x; // 기존 그대로 유지
                    } else {
                        return 1 - ((-2 * x + 2) ** 3 / 2) * 0.8; // 기울기 증가
                    }
                };
                function logDoubleFunction(x) {
                    return  Math.log2(Math.log2(x + 1) + 1);
                }
                const myStack = capsuleGrid[y - boundMinY][x - boundMinX];

                // start와의 거리에 따른 효과 강도 계산
                const effectFactor =
                    (1 - easeInOutCubic(dist / EFFECT_RADIUS)) *
                        force *MAGNIFY_STRENGTH *  0.5 * logDoubleFunction(myStack/EFFECT_RADIUS+1)*5

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
            }
        }
    }

    //console.log(sum)
}

// 1. Bresenham 알고리즘: 두 점 (x0, y0)와 (x1, y1)를 잇는 선상의 픽셀 좌표들을 반환
function bresenhamLine(x0, y0, x1, y1) {
    const coordinates = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        coordinates.push({ x: x0, y: y0 });
        if (x0 === x1 && y0 === y1) break;
        let e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
    return coordinates;
}

// 2. 차분 배열 업데이트 및 최종 결과 계산 함수
function generateResultGrid(width, height, R, centers) {
    // 차분 배열 초기화
    const diff = [];
    for (let y = 0; y < height; y++) {
        diff[y] = new Array(width).fill(0);
    }

    // 선분상의 각 픽셀(원 중심)에 대해 원의 영향을 업데이트
    centers.forEach((center) => {
        const cx = center.x;
        const cy = center.y;
        // y 방향 업데이트 범위: [cy - R, cy + R] (그리드 경계 내 클리핑)
        const yStart = Math.max(0, cy - R);
        const yEnd = Math.min(height - 1, cy + R);

        for (let y = yStart; y <= yEnd; y++) {
            const dy = y - cy;
            // 원 방정식에 따른 x 영향 범위: dx = floor(sqrt(R² - dy²))
            const dx = Math.floor(Math.sqrt(R * R - dy * dy));
            const xLeft = Math.max(0, cx - dx);
            const xRight = Math.min(width - 1, cx + dx);
            diff[y][xLeft] += 1;
            if (xRight + 1 < width) {
                diff[y][xRight + 1] -= 1;
            }
        }
    });

    // 누적합 계산하여 최종 결과 배열 복원
    const result = [];
    for (let y = 0; y < height; y++) {
        result[y] = new Array(width).fill(0);
        let sum = 0;
        for (let x = 0; x < width; x++) {
            sum += diff[y][x];
            result[y][x] = sum;
        }
    }
    return result;
}

// const width = 400;
//   const height = 400;
//   const R = 50;

//   // 선분: (50,50)에서 (200,350)까지
//   const P1 = { x: 50, y: 50 };
//   const P2 = { x: 200, y: 350 };

//   // Bresenham 알고리즘으로 선분상의 픽셀 좌표(원 중심) 구하기
//   const centers = bresenhamLine(P1.x, P1.y, P2.x, P2.y);

//   // 차분 배열 업데이트를 통해 최종 결과 배열 생성
//   const result = generateResultGrid(width, height, R, centers);

//console.log(result)
