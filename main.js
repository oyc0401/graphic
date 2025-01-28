// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 두 점을 기반으로 픽셀 유동화 효과
const EFFECT_RADIUS = 50; // 효과 반경
const MAGNIFY_STRENGTH = 1; // 확대 강도

function applyPixelFlow(canvas, ctx, x0, y0, x1, y1) {
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const originalImageData = ctx.getImageData(0, 0, width, height);

    const data = imageData.data;
    const radiusSquared = EFFECT_RADIUS * EFFECT_RADIUS;

    const dx = x1 - x0;
    const dy = y1 - y0;
    const lineLengthSquared = dx * dx + dy * dy;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const t = ((x - x0) * dx + (y - y0) * dy) / lineLengthSquared;
            let closestX, closestY;

            if (t < 0) {
                closestX = x0;
                closestY = y0;
            } else if (t > 1) {
                closestX = x1;
                closestY = y1;
            } else {
                closestX = x0 + t * dx;
                closestY = y0 + t * dy;
            }

            const distanceSquared = (x - closestX) ** 2 + (y - closestY) ** 2;

            if (distanceSquared <= radiusSquared) {
                const distance = Math.sqrt(distanceSquared);
                const influence = 1 - distance / EFFECT_RADIUS;

                const magnifyFactor = 1 + MAGNIFY_STRENGTH * influence;
                const offsetX = (x - closestX) * magnifyFactor + closestX;
                const offsetY = (y - closestY) * magnifyFactor + closestY;

                const x1 = Math.floor(offsetX);
                const x2 = x1 + 1;
                const y1 = Math.floor(offsetY);
                const y2 = y1 + 1;

                const wx2 = offsetX - x1;
                const wx1 = 1 - wx2;
                const wy2 = offsetY - y1;
                const wy1 = 1 - wy2;

                const getColor = (x, y) => {
                    if (x < 0 || x >= width || y < 0 || y >= height) return [0, 0, 0, 0];
                    const idx = (y * width + x) * 4;
                    return [
                        originalImageData.data[idx],
                        originalImageData.data[idx + 1],
                        originalImageData.data[idx + 2],
                        originalImageData.data[idx + 3],
                    ];
                };

                const color11 = getColor(x1, y1);
                const color12 = getColor(x1, y2);
                const color21 = getColor(x2, y1);
                const color22 = getColor(x2, y2);

                const blendColor = [
                    Math.round(
                        color11[0] * wx1 * wy1 +
                            color12[0] * wx1 * wy2 +
                            color21[0] * wx2 * wy1 +
                            color22[0] * wx2 * wy2
                    ),
                    Math.round(
                        color11[1] * wx1 * wy1 +
                            color12[1] * wx1 * wy2 +
                            color21[1] * wx2 * wy1 +
                            color22[1] * wx2 * wy2
                    ),
                    Math.round(
                        color11[2] * wx1 * wy1 +
                            color12[2] * wx1 * wy2 +
                            color21[2] * wx2 * wy1 +
                            color22[2] * wx2 * wy2
                    ),
                    Math.round(
                        color11[3] * wx1 * wy1 +
                            color12[3] * wx1 * wy2 +
                            color21[3] * wx2 * wy1 +
                            color22[3] * wx2 * wy2
                    ),
                ];

                const destIndex = (y * width + x) * 4;
                data[destIndex] = blendColor[0];
                data[destIndex + 1] = blendColor[1];
                data[destIndex + 2] = blendColor[2];
                data[destIndex + 3] = blendColor[3];
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);
        applyPixelFlow(canvas, ctx, 50, 50, 200, 300);
        drawHelperLine(ctx, 50, 50, 200, 300);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

const helper_canvas = document.getElementById("helper-canvas");
const helper_ctx = canvas.getContext("2d");

function drawHelperLine(ctx, x0, y0, x1, y1) {
    // 선 그리기
    ctx.beginPath(); // 새로운 경로 시작
    ctx.moveTo(x0, y0); // 시작 좌표 설정
    ctx.lineTo(x1, y1); // 끝 좌표 설정
    ctx.lineWidth = 1; // 선의 두께 설정
    ctx.strokeStyle = "blue"; // 선의 색상 설정
    ctx.stroke(); // 선을 그림

    // 시작점에 초록색 원 그리기
    ctx.fillStyle = "green"; // 초록색 설정
    ctx.beginPath();
    ctx.arc(x0, y0, 2, 0, Math.PI * 2);

    ctx.fill();

    // 끝점에 초록색 원 그리기
    ctx.beginPath();
    ctx.arc(x1, y1, 2, 0, Math.PI * 2);
    ctx.fill();
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
