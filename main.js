// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 20; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 0.2; // 강도: +이면 정방향, -이면 역방향

let lastIndex = 0;

function applyPixelFlow(canvas, ctx, points) {
    const width = canvas.width;
    const height = canvas.height;

    if (points.length - lastIndex - 1 === 0) {
        return;
    }

    // 초기 바운딩 박스 설정
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    // lastIndex부터 points.length - 1까지의 포인트를 기준으로 바운딩 박스 계산
    for (let i = lastIndex; i < points.length - 1; i++) {
        const startPoint = points[i];
        const endPoint = points[i + 1];
        minX = Math.min(minX, startPoint.x, endPoint.x);
        minY = Math.min(minY, startPoint.y, endPoint.y);
        maxX = Math.max(maxX, startPoint.x, endPoint.x);
        maxY = Math.max(maxY, startPoint.y, endPoint.y);
    }

    // 패딩 추가 및 캔버스 경계를 벗어나지 않도록 클램핑
    minX = Math.max(Math.floor(minX - EFFECT_RADIUS), 0);
    minY = Math.max(Math.floor(minY - EFFECT_RADIUS), 0);
    maxX = Math.min(Math.ceil(maxX + EFFECT_RADIUS), width);
    maxY = Math.min(Math.ceil(maxY + EFFECT_RADIUS), height);

    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;

    // Early exit if the region has no area
    if (regionWidth <= 0 || regionHeight <= 0) {
        return;
    }

    // 영역 이미지 데이터 가져오기
    const regionImageData = ctx.getImageData(
        minX,
        minY,
        regionWidth,
        regionHeight,
    );
    const originalPixels = regionImageData.data;

    // 변위 맵 초기화
    const displacementX = new Float32Array(regionWidth * regionHeight);
    const displacementY = new Float32Array(regionWidth * regionHeight);

    // 모든 선분에 대해 변위 계산
    for (let i = lastIndex; i < points.length - 1; i++) {
        const startPoint = points[i];
        const endPoint = points[i + 1];
        const x0 = startPoint.x;
        const y0 = startPoint.y;
        const x1 = endPoint.x;
        const y1 = endPoint.y;

        const deltaX = x1 - x0;
        const deltaY = y1 - y0;
        const segmentLength = Math.hypot(deltaX, deltaY);

        if (segmentLength === 0) {
            console.warn(`점 ${i}와 점 ${i + 1}가 동일합니다.`);
            lastIndex = i + 1;
            continue;
        }

        const unitX = deltaX / segmentLength;
        const unitY = deltaY / segmentLength;

        // 선분의 바운딩 박스 내에서만 반복
        const segmentMinY = Math.max(
            Math.floor(Math.min(y0, y1) - EFFECT_RADIUS),
            minY,
        );
        const segmentMaxY = Math.min(
            Math.ceil(Math.max(y0, y1) + EFFECT_RADIUS),
            maxY,
        );
        const segmentMinX = Math.max(
            Math.floor(Math.min(x0, x1) - EFFECT_RADIUS),
            minX,
        );
        const segmentMaxX = Math.min(
            Math.ceil(Math.max(x0, x1) + EFFECT_RADIUS),
            maxX,
        );

        for (let y = segmentMinY; y < segmentMaxY; y++) {
            for (let x = segmentMinX; x < segmentMaxX; x++) {
                const relativeX = x - minX;
                const relativeY = y - minY;
                const pixelIndex = relativeY * regionWidth + relativeX;

                // 선분과의 거리 계산
                const dx = x - x0;
                const dy = y - y0;
                const t = (dx * unitX + dy * unitY) / segmentLength;
                const clampedT = Math.max(0, Math.min(1, t));

                const closestX = x0 + clampedT * deltaX;
                const closestY = y0 + clampedT * deltaY;

                const distX = x - closestX;
                const distY = y - closestY;
                const distance = Math.hypot(distX, distY);

                if (distance < EFFECT_RADIUS) {
                    const effectFactor =
                        (1 - distance / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;

                    const offsetX = (effectFactor * deltaX) / 2;
                    const offsetY = (effectFactor * deltaY) / 2;

                    const maxOffsetX = effectFactor * unitX * 10;
                    const maxOffsetY = effectFactor * unitY * 10;

                    // 변위 누적 (절댓값이 작은 값을 선택)
                    displacementX[pixelIndex] += smallerAbs(
                        offsetX,
                        maxOffsetX,
                    );
                    displacementY[pixelIndex] += smallerAbs(
                        offsetY,
                        maxOffsetY,
                    );
                }
            }
        }

        lastIndex = i + 1;
    }

    // 새로운 영역 이미지 데이터 생성
    const newImageDataArray = new Uint8ClampedArray(originalPixels.length);

    for (let y = 0; y < regionHeight; y++) {
        for (let x = 0; x < regionWidth; x++) {
            const pixelIndex = y * regionWidth + x;
            const totalOffsetX = displacementX[pixelIndex];
            const totalOffsetY = displacementY[pixelIndex];
            const newX = x + totalOffsetX;
            const newY = y + totalOffsetY;

            // 양선형 보간
            const floorX = Math.floor(newX);
            const floorY = Math.floor(newY);
            const ceilX = Math.min(Math.ceil(newX), regionWidth - 1);
            const ceilY = Math.min(Math.ceil(newY), regionHeight - 1);
            const tx = newX - floorX;
            const ty = newY - floorY;

            const getColor = (xx, yy) => {
                if (
                    xx >= 0 &&
                    xx < regionWidth &&
                    yy >= 0 &&
                    yy < regionHeight
                ) {
                    const idx = (yy * regionWidth + xx) * 4;
                    return [
                        originalPixels[idx],
                        originalPixels[idx + 1],
                        originalPixels[idx + 2],
                        originalPixels[idx + 3],
                    ];
                }
                return [0, 0, 0, 0];
            };

            const color00 = getColor(floorX, floorY);
            const color10 = getColor(ceilX, floorY);
            const color01 = getColor(floorX, ceilY);
            const color11 = getColor(ceilX, ceilY);

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

            const [r, g, b, a] = interpolate(
                color00,
                color10,
                color01,
                color11,
                tx,
                ty,
            );
            const newPixelIndex = pixelIndex * 4;
            newImageDataArray[newPixelIndex] = r;
            newImageDataArray[newPixelIndex + 1] = g;
            newImageDataArray[newPixelIndex + 2] = b;
            newImageDataArray[newPixelIndex + 3] = a;
        }
    }

    // 수정된 영역 이미지를 캔버스에 다시 그리기
    const finalImageData = new ImageData(
        newImageDataArray,
        regionWidth,
        regionHeight,
    );
    ctx.putImageData(finalImageData, minX, minY);
}

const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);


// 초기화
window.onload = async () => {
    try {
        //const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        // applyPixelFlow(canvas, ctx, [
        //     // { x: 50, y: 100 },
        //     // { x: 200, y: 200 },
        //     //  { x: 300, y: 170 },
        // ]);
        // drawHelperLine(ctx, [
        //     // { x: 100, y: 100 },
        //     // { x: 110, y: 110 },
        //     // { x: 120, y: 120 },
        //     // { x: 150, y: 150 },
        //     // { x: 200, y: 200 },
        // ]);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

// { x: 100, y: 100 },
// { x: 110, y: 110 },
// { x: 120, y: 120 },
// { x: 150, y: 150 },
// { x: 200, y: 200 },

// { x: 50, y: 100 },
// { x: 200, y: 200 },
//  { x: 300, y: 170 },

// { x: 50, y: 100 },
// { x: 200, y: 200 },
//  { x: 220, y: 300 },
//    { x: 120, y: 300 },
//  { x: 50, y: 100 },

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
document.addEventListener("mousemove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;

        // 현재 좌표를 배열에 저장
        positions.push({ x: clientX, y: clientY });
        applyPixelFlow(canvas, ctx, positions);
    }
});

// 스페이스바 뗐을 때 추적 종료 및 로그 출력
document.addEventListener("pointerup", (event) => {
    isTracking = false;
});
