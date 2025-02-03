// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 10; // 뒤틀기 효과 반경
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

    // unit 방향에 따라 x, y 루프 순서를 결정 (unitX가 양수면 boundMinX부터, 음수면 boundMaxX부터; unitY도 마찬가지)
    let xStart, xEnd, stepX;
    let yStart, yEnd, stepY;

    if (unitX > 0 && unitY > 0) {
        // unitX와 unitY가 양수인 경우: x와 y 모두 boundMax에서 boundMin 방향으로 반복
        xStart = boundMaxX;
        xEnd = boundMinX;
        stepX = -1;

        yStart = boundMaxY;
        yEnd = boundMinY;
        stepY = -1;
    } else {
        // 그 외의 경우: 기존 방식대로 설정
        if (unitX >= 0) {
            xStart = boundMinX;
            xEnd = boundMaxX;
            stepX = 1;
        } else {
            xStart = boundMaxX;
            xEnd = boundMinX;
            stepX = -1;
        }

        if (unitY >= 0) {
            yStart = boundMinY;
            yEnd = boundMaxY;
            stepY = 1;
        } else {
            yStart = boundMaxY;
            yEnd = boundMinY;
            stepY = -1;
        }
    }

    // 바운딩 박스 내의 각 픽셀에 대해 원 내부에 있는지 확인한 후 효과 적용
    for (let y = yStart; stepY > 0 ? y <= yEnd : y >= yEnd; y += stepY) {
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
                    MAGNIFY_STRENGTH/2;

                // offset 계산 (두 방향 간의 보정도 포함)
                const offsetX = diffX.x / Math.pow(2, effectFactor) - diffX.x;
                const offsetY = diffY.y / Math.pow(2, effectFactor) - diffY.y;

                const offsetX2Y = diffX.y / Math.pow(2, effectFactor) - diffX.y;

                const offsetY2X = diffY.x / Math.pow(2, effectFactor) - diffY.x;

                // 누적 변위 업데이트 (smallerAbs 함수는 두 값 중 절대값이 작은 쪽을 선택)
                displaceX[index] += offsetX * unitX;
                displaceY[index] += offsetX2Y* unitX;

                displaceY[index] += offsetY * unitY;
               displaceX[index] += offsetY2X* unitY;

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

// 초기화
window.onload = async () => {
    try {
        //const img = await loadImageFromURL("check.png");
        // const img = await loadImageFromURL("cat.webp");
        const img = await loadImageFromURL("musk.png");
        drawImageToCanvas(img);

        initPixelFlow(canvas, ctx);
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
document.addEventListener("pointermove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;
        let width = canvas.width;
        let height = canvas.height;

        // 현재 좌표를 배열에 저장
        positions.push({ x: clientX, y: clientY });

        if (positions.length < 2) {
            return;
        }

        sum = 0;
        lastIndex = positions.length - 1;
        const start = positions[lastIndex - 1];
        const end = positions[lastIndex];

        // // Bresenham 알고리즘을 사용하여 두 점 사이의 모든 정수 좌표를 구하는 함수
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

       // console.log(sum);
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

function applyPixelFlowLine(canvas, start, end) {
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

                // 위로 밀기

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
                // x가 1에 가까워질수록 1에 근접해진다.

                const effectFactor =
                    (1 - easeInOutCubic(dist / EFFECT_RADIUS)) *
                    -MAGNIFY_STRENGTH;

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

    //console.log(sum)
}
