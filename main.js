// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 20; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 0.5; // 강도: +이면 정방향, -이면 역방향

// 두 점을 기반으로 하는 픽셀 유동화
function applyPixelFlow(canvas, ctx, x0, y0, x1, y1) {
    const width = canvas.width;
    const height = canvas.height;

    // 픽셀 데이터를 가져옴
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 새로운 픽셀 데이터를 위한 버퍼
    const newImageData = new Uint8ClampedArray(data);

    // 선의 길이와 방향 벡터 계산
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.sqrt(dx * dx + dy * dy);

    // 선의 단위 벡터
    let unitX = dx / length;
    let unitY = dy / length;

    // 선이 없는 경우 함수 종료
    if (length === 0) {
        console.warn("두 점이 동일합니다. 선을 정의할 수 없습니다.");
        return;
    }

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
                newImageData[index] = r;
                newImageData[index + 1] = g;
                newImageData[index + 2] = b;
                newImageData[index + 3] = a;
            } else {
                // 반경 밖은 원래 픽셀 그대로 복사
                newImageData[index] = data[index];
                newImageData[index + 1] = data[index + 1];
                newImageData[index + 2] = data[index + 2];
                newImageData[index + 3] = data[index + 3];
            }
        }
    }

    // 결과를 캔버스에 적용
    const outputImageData = new ImageData(newImageData, width, height);
    ctx.putImageData(outputImageData, 0, 0);
}

// 초기화
window.onload = async () => {
    try {
        //const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        applyPixelFlow(canvas, ctx, 50, 100, 200, 200);
        drawHelperLine(ctx, 50, 100, 200, 200);
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
