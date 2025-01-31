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

/**
 * 두 Float32Array 행렬 a와 b를 받아서 f(a, b) = a + b * (1 - a)를 계산합니다.
 * @param {Float32Array} a - 첫 번째 입력 행렬
 * @param {Float32Array} b - 두 번째 입력 행렬
 * @returns {Float32Array} - 결과 행렬 f(a, b)
 */
function interpolate(a, b) {
    if (a.length !== b.length) {
        throw new Error("Input arrays must have the same length.");
    }

    const result = new Float32Array(a.length);

    for (let i = 0; i < a.length; i++) {
        if (a[i] > 0 && b[i] > 0) {
            result[i] = (a[i] + b[i] + a[i] * b[i]) / 2;
        } else {
            result[i] = a[i] + b[i];
        }
    }

    return result;
}

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

    let sum = 0;

    let tempDisplaceX = new Float32Array(width * height);
    let tempDisplaceY = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;

            // (원래 x + 누적 displace) = 현재 픽셀이 실제 화면상 갖는 좌표
            let currentX = x; //+ displaceX[index];
            let currentY = y; // + displaceY[index];

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
                const effectFactor =
                    Math.sin((1 - dist / EFFECT_RADIUS) * (Math.PI / 2)) *
                    -MAGNIFY_STRENGTH;
                const offsetX = (effectFactor * dx) / 2; //* diffX;
                const offsetY = (effectFactor * dy) / 2; //* diffY;
                //const maxoffsetX = effectFactor * unitX * 10 //* diffX;
                // const maxoffsetY = effectFactor * unitY * 10 //* diffY;

                // 누적 변위 갱신
                let plusForceX = offsetX;
                let plusForceY = offsetY;
                tempDisplaceX[index] += plusForceX;
                tempDisplaceY[index] += plusForceY;

                // 렌더링 해야하는 범위 찾기
                renderStartX = Math.floor(Math.min(renderStartX ?? x, x));
                renderStartY = Math.floor(Math.min(renderStartY ?? y, y));
                renderEndX = Math.ceil(Math.max(renderEndX ?? x, x));
                renderEndY = Math.ceil(Math.max(renderEndY ?? y, y));
                sum++;
            }
        }
    }

    displaceX = interpolate(displaceX, tempDisplaceX);
    displaceY = interpolate(displaceY, tempDisplaceY);

    // console.log(sum)
}

function renderToImage(canvas) {
    const width = canvas.width;
    const height = canvas.height;

    const newImageData = new Uint8ClampedArray(originalData.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const totalDx = displaceX[index];
            const totalDy = displaceY[index];
            const newX = x + totalDx;
            const newY = y + totalDy;

            // 양선형 보간
            const floorX = Math.floor(newX);
            const floorY = Math.floor(newY);
            const ceilX = Math.ceil(newX);
            const ceilY = Math.ceil(newY);
            const tx = newX - floorX;
            const ty = newY - floorY;

            const getColor = (xx, yy) => {
                if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
                    const idx = (yy * width + xx) * 4;
                    return [
                        originalData[idx],
                        originalData[idx + 1],
                        originalData[idx + 2],
                        originalData[idx + 3],
                    ];
                }
                return [0, 0, 0, 0];
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
            const newIndex = index * 4;
            newImageData[newIndex] = r;
            newImageData[newIndex + 1] = g;
            newImageData[newIndex + 2] = b;
            newImageData[newIndex + 3] = a;
        }
    }

    // console.log(displaceX);
    let imageData = new ImageData(newImageData, width, height);

    ctx.putImageData(imageData, 0, 0);
}

const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check_r.png"); // 프로젝트 폴더 내 image.jpg 경로
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

    //initPixelFlow(canvas, ctx);
    ctx.fillStyle = "rgba(255,0,0,0.1)";
    console.log("Tracking 시작...");
});

const infoBox = document.getElementById("info-box");

// 마우스 움직임 기록
document.addEventListener("mousemove", (event) => {
    const { clientX, clientY } = event;

    const indexX = clientX + canvas.width * clientY;
    const indexY = clientY + canvas.height * clientX;

    const dispX = displaceX[indexX] || 0;
    const dispY = displaceY[indexY] || 0;

    const viewX = clientX + dispX;
    const viewY = clientY + dispY;

    // 박스 업데이트
    infoBox.style.left = `${clientX + 15}px`;
    infoBox.style.top = `${clientY + 15}px`;
    infoBox.innerHTML = `
          displace: (${dispX.toFixed(2)}, ${dispY.toFixed(2)})<br>
          position: (${clientX.toFixed(2)}, ${clientY.toFixed(2)})<br>
          view position: (${viewX.toFixed(2)}, ${viewY.toFixed(2)})
      `;

    if (isTracking) {
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

        renderToImage(canvas);

        //console.log('(',renderStartX, renderStartY, renderEndX, renderEndY,')', renderEndX-renderStartX,renderEndY- renderStartY);
        // console.log(renderEndX - renderStartX, renderEndY - renderStartY);
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
