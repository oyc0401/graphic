// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 5; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 0.5; // 강도: +이면 정방향, -이면 역방향

function applyPixelFlow(canvas, ctx, points) {
    const width = canvas.width;
    const height = canvas.height;

    // 원본 이미지 데이터 가져오기
    const originalImageData = ctx.getImageData(0, 0, width, height);
    const originalData = originalImageData.data;

    // 변위 맵 초기화
    const displaceX = new Float32Array(width * height);
    const displaceY = new Float32Array(width * height);

    // 어떤 획집합에 속해있는지 담고있는 함수.
    // 이후에 획집합이 1차이가 난다면 이후에 적용된 획집합이 넣어진다.
    const unionFind = new Float32Array(width * height).fill(-10);
    const overlaps = new Float32Array(width * height);

    // 변위 맵 초기화
    const sumX = new Float32Array(width * height);
    const sumY = new Float32Array(width * height);

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
                    const offsetX = effectFactor * unitX * EFFECT_RADIUS;
                    const offsetY = effectFactor * unitY * EFFECT_RADIUS;
                    if (i - unionFind[index] == 1) {
                        // 이전과 같은 집합.
                        unionFind[index] = i;

                        // 변위 합 저장
                        sumX[index] += offsetX;
                        sumY[index] += offsetY;
                        overlaps[index]++;
                    } else {
                        if (overlaps[index]) {
                            //이전 평균은 배열에 반영.
                            displaceX[index] += sumX[index] / overlaps[index];
                            displaceY[index] += sumY[index] / overlaps[index];
                        }

                        // 새로운 집합 생성.
                        unionFind[index] = i;
                        overlaps[index] = 1;

                        // 변위 누적
                        sumX[index] = offsetX;
                        sumY[index] = offsetY;
                    }
                } else {
                    if (overlaps[index]) {
                        displaceX[index] += sumX[index] / overlaps[index];
                        displaceY[index] += sumY[index] / overlaps[index];
                        overlaps[index] = 0;
                    }
                }
            }
        }
    }

    // 적용되지 못한 벡터들 적용.

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // if (sumX[index] != 0) {
            const index = y * width + x;
            if (overlaps[index]) {
                displaceX[index] += sumX[index] / overlaps[index];
                displaceY[index] += sumY[index] / overlaps[index];
            }

            // }
        }
    }

    // 새로운 이미지 데이터 생성
    const newImageData = new Uint8ClampedArray(originalData.length);

    //console.log(displaceX)

    // displaceX는 해당 픽셀의 변화한 위치 담고있는 배열이다.
    // (2,2)에서 (2.3,2.3)이 되었다면.
    // (2,2), (2,3), (3,2), (3,3)의 색을 모두 가져와 평균을 낸다.

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

            if (index == 28) {
                console.log("now!");
            }

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

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        //const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        applyPixelFlow(canvas, ctx, [
            { x: 50, y: 100 },
            { x: 200, y: 200 },
             { x: 220, y: 300 },
               { x: 120, y: 300 },
             { x: 50, y: 100 },
            { x: 200, y: 200 },
        ]);
        drawHelperLine(ctx,[
            { x: 50, y: 100 },
            { x: 200, y: 200 },
             { x: 220, y: 300 },
               { x: 120, y: 300 },
             { x: 50, y: 100 },
            { x: 200, y: 200 },
        ]);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

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
        return `rgba(${r},${g},${b},0.5`;
    };

    // Draw lines between consecutive points
    for (let i = 0; i < totalPoints - 1; i++) {
        const start = points[i];
        const end = points[i + 1];

        ctx.beginPath(); // Start a new path
        ctx.moveTo(start.x, start.y); // Move to the start point
        ctx.lineTo(end.x, end.y); // Draw a line to the end point
        ctx.lineWidth = 1; // Set line width
        ctx.strokeStyle = "rgba(0,0,255,0.5)"; // Set line color to blue
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
