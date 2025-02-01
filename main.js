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

let renderStartX;
let renderStartY;
let renderEndX;
let renderEndY;

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

    if (length == 0) {
        return;
    }
    const unitX = dx / length;
    const unitY = dy / length;

    // x축 순회 조건
    const startX = unitX >= 0 ? 0 : width - 1;
    const endX = unitX >= 0 ? width : -1;
    const stepX = unitX >= 0 ? 1 : -1;

    // y축 순회 조건
    const startY = unitY >= 0 ? 0 : height - 1;
    const endY = unitY >= 0 ? height : -1;
    const stepY = unitY >= 0 ? 1 : -1;

    for (let y = startY; y !== endY; y += stepY) {
        for (let x = startX; x !== endX; x += stepX) {
            const index = y * width + x;

            // (원래 x + 누적 displace) = 현재 픽셀이 실제 화면상 갖는 좌표
            let currentX = x; //+ displaceX[index];
            let currentY = y; //+ displaceY[index];

            // start~end 선분과 거리 계산(화면 좌표계)
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
                let diffX;
                let diffY;

                // 우측으로 밀엇을 때 좌측과의 x차이도 맞춰야하고
                // 우측으로 밀었을 때 좌측과의 y차이를 맞춰야한다.
                let diffL = { x: 0, x: 0 };
                let diffR = { x: 0, x: 0 };
                let diffT = { x: 0, x: 0 };
                let diffB = { x: 0, x: 0 };
                // -> 방향으로 밀기

                if (unitX > 0) {
                    if (x == 0) {
                        diffL.x = displaceX[index];
                        diffL.y = displaceY[index];
                    } else {
                        let leftIdx = y * width + (x - 1);
                        diffL.x = displaceX[index] + 1 - displaceX[leftIdx];
                        diffL.y = displaceY[index] - displaceY[leftIdx];
                    }
                }
                // <-으로 밀기
                else {
                    // <-으로 밀기
                    if (x == width - 1) {
                        diffR.x = -displaceX[index];
                        diffR.y = displaceY[index];
                    } else {
                        let rightIdx = y * width + (x + 1);
                        diffR.x = displaceX[rightIdx] + 1 - displaceX[index];
                        diffR.y = displaceY[rightIdx] - displaceY[index];
                    }
                }

                if (unitY > 0) {
                    //아래로 밀기, 위랑 비교
                    if (y == 0) {
                        diffT.x = displaceX[index];
                        diffT.y = displaceY[index]; // or 탑이 1
                    } else {
                        let topIdx = (y - 1) * width + x;
                        diffT.x = displaceX[index] - displaceX[topIdx];
                        diffT.y = displaceY[index] + 1 - displaceY[topIdx];
                    }
                }
                // 위로 밀기
                else {
                    if (y == height - 1) {
                        diffB.x = displaceX[index];
                        diffB.y = -displaceY[index]; // or 바텀이 -1
                    } else {
                        let bottomIdx = (y + 1) * width + x;
                        diffB.x = displaceX[bottomIdx] - displaceX[index];
                        diffB.y = displaceY[bottomIdx] + 1 - displaceY[index];
                    }
                }
                ////////////////////////////////

                diffX = unitX > 0 ? diffL : diffR;
                diffY = unitY > 0 ? diffT : diffB;

                ////////////////////////////////////////////////////

                const effectFactor =
                    (1 - dist / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;
                const offsetX = ((effectFactor * unitX) / 2) * diffX.x;
                const offsetY = ((effectFactor * unitY) / 2) * diffY.y;
                const maxoffsetX = effectFactor * unitX * 10 * diffX.x;
                const maxoffsetY = effectFactor * unitY * 10 * diffY.y;

                // x방향으로 했을 때 더할 y값
                const offsetX2Y = ((effectFactor * unitX) / 2) * diffX.y; // y값에 더할 값
                const offsetY2X = ((effectFactor * unitY) / 2) * diffY.x;

                const maxoffsetX2Y = effectFactor * unitX * 10 * diffX.y;
                const maxoffsetY2X = effectFactor * unitY * 10 * diffY.x;

                // 누적 변위 갱신
                displaceX[index] += smallerAbs(offsetX, maxoffsetX);
                displaceY[index] += smallerAbs(offsetY, maxoffsetY);

                displaceY[index] += smallerAbs(offsetX2Y, maxoffsetX2Y);
                displaceX[index] += smallerAbs(offsetY2X, maxoffsetY2X);

                // 렌더링 해야하는 범위 찾기
                renderStartX = Math.floor(Math.min(renderStartX ?? x, x));
                renderStartY = Math.floor(Math.min(renderStartY ?? y, y));
                renderEndX = Math.ceil(Math.max(renderEndX ?? x, x));
                renderEndY = Math.ceil(Math.max(renderEndY ?? y, y));
            }
        }
    }
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
            newX = Math.min(Math.max(newX, 0), canvas_w - 1);
            newY = Math.min(Math.max(newY, 0), canvas_h - 1);

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
        const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        //const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        initPixelFlow(canvas, ctx);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 스페이스바 누름 상태

// 스페이스바 눌렀을 때 추적 시작
document.addEventListener("pointerdown", (event) => {
    isTracking = true;
    positions = []; // 이전 데이터 초기화
    lastIndex = 0;
    renderStartX = renderStartY = renderEndX = renderEndY = undefined;
});

// 마우스 움직임 기록
document.addEventListener("mousemove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;

        // 현재 좌표를 배열에 저장
        positions.push({ x: clientX, y: clientY });

        if (positions.length < 2) {
            return;
        }

        lastIndex = positions.length - 1;
        const start = positions[lastIndex - 1];
        const end = positions[lastIndex];
        renderStartX = renderStartY = renderEndX = renderEndY = undefined;

        applyPixelFlow(canvas, start, end);

        renderToImage(
            canvas,
            renderStartX,
            renderStartY,
            renderEndX,
            renderEndY,
        );
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
