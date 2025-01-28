// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 50; // 효과 반경
const MAGNIFY_STRENGTH = 1; // 확대 강도

// 두 점을 기반으로 픽셀 유동화 효과
function applyPixelFlow(canvas, ctx, x0, y0, x1, y1) {
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const originalImageData = ctx.getImageData(0, 0, width, height);

    const data = imageData.data;

    const radiusSquared = EFFECT_RADIUS * EFFECT_RADIUS;

    // 선분의 방향 벡터와 길이
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lineLengthSquared = dx * dx + dy * dy;

    // 모든 픽셀 순회
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 선분과 픽셀 간의 최소 거리 계산
            const t = ((x - x0) * dx + (y - y0) * dy) / lineLengthSquared;
            let closestX, closestY;

            if (t < 0) {
                // 선분의 시작점이 가장 가까운 경우
                closestX = x0;
                closestY = y0;
            } else if (t > 1) {
                // 선분의 끝점이 가장 가까운 경우
                closestX = x1;
                closestY = y1;
            } else {
                // 선분 내부에서 가장 가까운 점
                closestX = x0 + t * dx;
                closestY = y0 + t * dy;
            }

            const distanceSquared = (x - closestX) ** 2 + (y - closestY) ** 2;

            if (distanceSquared <= radiusSquared) {
                // 거리 기반으로 확대 강도 계산
                const distance = Math.sqrt(distanceSquared);
                const influence = 1 - distance / EFFECT_RADIUS;

                // 확대 강도에 따른 픽셀 이동
                const magnifyFactor = 1 + MAGNIFY_STRENGTH * influence;
                const offsetX = Math.round(
                    (x - closestX) * magnifyFactor + closestX,
                );
                const offsetY = Math.round(
                    (y - closestY) * magnifyFactor + closestY,
                );

                // 원본 데이터에서 픽셀 색상 복사
                if (
                    offsetX >= 0 &&
                    offsetX < width &&
                    offsetY >= 0 &&
                    offsetY < height
                ) {
                    const srcIndex = (offsetY * width + offsetX) * 4;
                    const destIndex = (y * width + x) * 4;

                    data[destIndex] = originalImageData.data[srcIndex];
                    data[destIndex + 1] = originalImageData.data[srcIndex + 1];
                    data[destIndex + 2] = originalImageData.data[srcIndex + 2];
                    data[destIndex + 3] = originalImageData.data[srcIndex + 3];
                }
            }
        }
    }

    // 변형된 데이터를 캔버스에 업데이트
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
