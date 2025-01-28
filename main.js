// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 50; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 0.01; // 강도: +이면 정방향, -이면 역방향


let hadMax=false;
function applyPixelFlow(canvas, ctx, points) {
    const width = canvas.width;
    const height = canvas.height;

    // 원본 이미지 데이터 가져오기
    const originalImageData = ctx.getImageData(0, 0, width, height);
    const originalData = originalImageData.data;

    // 변위 맵 초기화
    const displaceX = new Float32Array(width * height);
    const displaceY = new Float32Array(width * height);

    // 모든 선분에 대해 변위 계산
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const x0 = start.x;
        const y0 = start.y;
        const x1 = end.x;
        const y1 = end.y;

        const dx = x1 - x0;
        const dy = y1 - y0;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) {
            console.warn(`점 ${i}와 점 ${i + 1}가 동일합니다.`);
            continue;
        }

        const unitX = dx / length;
        const unitY = dy / length;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;

                // 선분과의 거리 계산
                const px = x - x0;
                const py = y - y0;
                const t = (px * unitX + py * unitY) / length;
                const clampedT = Math.max(0, Math.min(1, t));

                const closestX = x0 + clampedT * unitX * length;
                const closestY = y0 + clampedT * unitY * length;

                const distX = x - closestX;
                const distY = y - closestY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < EFFECT_RADIUS) {
                    const effectFactor =
                        (1 - dist / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;

                    const offsetX = effectFactor * dx * 0.4;
                    const offsetY = effectFactor * dy * 0.4;

                    const maxoffsetX = effectFactor * unitX *10;
                    const maxoffsetY = effectFactor * unitY * 10 ;

                    // 변위 누적
                    displaceX[index] += smallerAbs(offsetX, maxoffsetX);
                    displaceY[index] += smallerAbs(offsetY, maxoffsetY);

                    if (Math.abs(offsetX) > Math.abs(maxoffsetX)) {
                        hadMax=true;
                      
                    }
                }
            }
        }
    }

    // 새로운 이미지 데이터 생성
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

    ctx.putImageData(new ImageData(newImageData, width, height), 0, 0);
}
const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        //const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        applyPixelFlow(canvas, ctx, [
            // { x: 50, y: 100 },
            // { x: 200, y: 200 },
            //  { x: 300, y: 170 },
        ]);
        drawHelperLine(ctx, [
            // { x: 100, y: 100 },
            // { x: 110, y: 110 },
            // { x: 120, y: 120 },
            // { x: 150, y: 150 },
            // { x: 200, y: 200 },
        ]);
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
const positions = [];
let isTracking = false; // 스페이스바 누름 상태

// 마우스 움직임 기록
document.addEventListener("mousemove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;

        // 현재 좌표를 배열에 저장
        positions.push({ x: clientX, y: clientY });
    }
});

// 스페이스바 눌렀을 때 추적 시작
document.addEventListener("pointerdown", (event) => {
    isTracking = true;
    positions.length = 0; // 이전 데이터 초기화
    console.log("Tracking 시작...");
});

// 스페이스바 뗐을 때 추적 종료 및 로그 출력
document.addEventListener("pointerup", (event) => {
    isTracking = false;
    console.log("Tracking 종료. 기록된 좌표:");
    // console.log(positions);

    applyPixelFlow(canvas, ctx, positions);
    // drawHelperLine(ctx, positions);
if(hadMax){
     console.log("max!");
    hadMax=false;
}
 
});
