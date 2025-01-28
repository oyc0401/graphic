// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 20; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 0.5; // 강도: +이면 정방향, -이면 역방향

// 여러 선을 기반으로 하는 픽셀 유동화
function applyPixelFlow(canvas, ctx, points) {
    const width = canvas.width;
    const height = canvas.height;

    // 초기 픽셀 데이터를 가져옴
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;

    // 새로운 픽셀 데이터를 위한 버퍼 (복사본 생성)
    let newImageData = new Uint8ClampedArray(data);

    // Iterate through each consecutive pair of points
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const x0 = start.x;
        const y0 = start.y;
        const x1 = end.x;
        const y1 = end.y;

        // 선의 길이와 방향 벡터 계산
        const dx = x1 - x0;
        const dy = y1 - y0;
        const length = Math.sqrt(dx * dx + dy * dy);

        // 선이 없는 경우 다음 선으로 건너뜀
        if (length === 0) {
            console.warn(`점 ${i}와 점 ${i + 1}가 동일합니다. 선을 정의할 수 없습니다.`);
            continue;
        }

        // 선의 단위 벡터
        const unitX = dx / length;
        const unitY = dy / length;

        // Iterate through each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                // 픽셀과 선 사이의 최소 거리 계산
                const px = x - x0;
                const py = y - y0;

                // 선 위에서 픽셀과 가장 가까운 점의 위치 파라미터 t
                const t = (px * unitX + py * unitY) / length;

                // t를 [0,1] 범위로 클램핑
                const clampedT = Math.max(0, Math.min(1, t));

                // 가장 가까운 점의 좌표
                const closestX = x0 + clampedT * unitX * length;
                const closestY = y0 + clampedT * unitY * length;

                // 픽셀과 가장 가까운 점 사이의 거리
                const distX = x - closestX;
                const distY = y - closestY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < EFFECT_RADIUS) {
                    // 효과 강도 계산
                    const effectFactor =
                        (1 - dist / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;

                    // 왜곡 좌표 계산 (소수점 포함)
                    const offsetX = effectFactor * unitX * EFFECT_RADIUS;
                    const offsetY = effectFactor * unitY * EFFECT_RADIUS;
                    const newX = x + offsetX;
                    const newY = y + offsetY;

                    // 양선형 보간법 적용
                    const floorX = Math.floor(newX);
                    const floorY = Math.floor(newY);
                    const ceilX = Math.ceil(newX);
                    const ceilY = Math.ceil(newY);

                    const tX = newX - floorX; // X축 보간 비율
                    const tY = newY - floorY; // Y축 보간 비율

                    // 주변 픽셀 색상 가져오기 (RGBA)
                    const getColor = (xx, yy) => {
                        if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
                            const idx = (yy * width + xx) * 4;
                            return [
                                data[idx],
                                data[idx + 1],
                                data[idx + 2],
                                data[idx + 3],
                            ];
                        }
                        return [0, 0, 0, 0]; // 캔버스 바깥 영역은 투명
                    };

                    const color00 = getColor(floorX, floorY);
                    const color10 = getColor(ceilX, floorY);
                    const color01 = getColor(floorX, ceilY);
                    const color11 = getColor(ceilX, ceilY);

                    // 보간 계산
                    const interpolate = (c00, c10, c01, c11, tX, tY) => {
                        const r =
                            c00[0] * (1 - tX) * (1 - tY) +
                            c10[0] * tX * (1 - tY) +
                            c01[0] * (1 - tX) * tY +
                            c11[0] * tX * tY;
                        const g =
                            c00[1] * (1 - tX) * (1 - tY) +
                            c10[1] * tX * (1 - tY) +
                            c01[1] * (1 - tX) * tY +
                            c11[1] * tX * tY;
                        const b =
                            c00[2] * (1 - tX) * (1 - tY) +
                            c10[2] * tX * (1 - tY) +
                            c01[2] * (1 - tX) * tY +
                            c11[2] * tX * tY;
                        const a =
                            c00[3] * (1 - tX) * (1 - tY) +
                            c10[3] * tX * (1 - tY) +
                            c01[3] * (1 - tX) * tY +
                            c11[3] * tX * tY;

                        return [r, g, b, a];
                    };

                    const [r, g, b, a] = interpolate(
                        color00,
                        color10,
                        color01,
                        color11,
                        tX,
                        tY,
                    );

                    // 결과를 새로운 이미지 데이터에 저장
                    // 평균 또는 합산을 통해 여러 선의 영향을 받을 수 있도록 조정 가능
                    newImageData[index] = r;
                    newImageData[index + 1] = g;
                    newImageData[index + 2] = b;
                    newImageData[index + 3] = a;
                }
            }
        }

        // 업데이트된 이미지 데이터를 현재 데이터로 설정
        imageData = new ImageData(newImageData, width, height);
        data = imageData.data;
    }

    // 최종 결과를 캔버스에 적용
    ctx.putImageData(imageData, 0, 0);
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
             { x: 300, y: 170 },
        ]);
        drawHelperLine(ctx,[
            { x: 50, y: 100 },
            { x: 200, y: 200 },
             { x: 300, y: 170 },
            
        ]);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

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
        return `rgb(${r},${g},${b})`;
    };

    // Draw lines between consecutive points
    for (let i = 0; i < totalPoints - 1; i++) {
        const start = points[i];
        const end = points[i + 1];

        ctx.beginPath(); // Start a new path
        ctx.moveTo(start.x, start.y); // Move to the start point
        ctx.lineTo(end.x, end.y); // Draw a line to the end point
        ctx.lineWidth = 1; // Set line width
        ctx.strokeStyle = "blue"; // Set line color to blue
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
