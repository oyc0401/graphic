// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const EFFECT_RADIUS = 2; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

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

                /////////////////////////////////

                if (unitX > 0) {
                    diffX = diffL;
                } else {
                    diffX = diffR;
                }

                if (unitY > 0) {
                    diffY = diffT;
                } else {
                    diffY = diffB;
                }
                ////////////////////////////////////////////////////

            
                const effectFactor =
                    (1 - dist / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;
                const offsetX = ((effectFactor * dx) / 2) * diffX.x;
                const offsetY = ((effectFactor * dy) / 2) * diffY.y;
                const maxoffsetX = effectFactor * unitX * 10;
                const maxoffsetY = effectFactor * unitY * 10;

                const offsetX2Y = ((effectFactor * dx) / 2) * diffX.y; // y값에 더할 값
                const offsetY2X = ((effectFactor * dy) / 2) * diffY.x;

                // 누적 변위 갱신
                displaceX[index] += smallerAbs(offsetX, maxoffsetX);
                displaceY[index] += smallerAbs(offsetY, maxoffsetY);

                displaceX[index] += offsetY2X; //, maxoffsetX);
                displaceY[index] += offsetX2Y; //, maxoffsetY);

                // // 렌더링 해야하는 범위 찾기
                // renderStartX = Math.floor(Math.min(renderStartX ?? x, x));
                // renderStartY = Math.floor(Math.min(renderStartY ?? y, y));
                // renderEndX = Math.ceil(Math.max(renderEndX ?? x, x));
                // renderEndY = Math.ceil(Math.max(renderEndY ?? y, y));
            }
        }
    }
}

function renderToImage(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const newImageData = new Uint8ClampedArray(width * height * 4);

    let idxx = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;

            const totalDx = displaceX[index];
            const totalDy = displaceY[index];
            let newX = x + totalDx;
            let newY = y + totalDy;

            // 좌표를 이미지 경계 내로 클램핑
            newX = Math.min(Math.max(newX, 0), width - 1);
            newY = Math.min(Math.max(newY, 0), height - 1);

            // 양선형 보간 (기존과 동일)
            const floorX = Math.floor(newX);
            const floorY = Math.floor(newY);
            const ceilX = Math.ceil(newX);
            const ceilY = Math.ceil(newY);
            const tx = newX - floorX;
            const ty = newY - floorY;

            const getColor = (xx, yy) => {
                const clampedX = Math.min(Math.max(xx, 0), width - 1);
                const clampedY = Math.min(Math.max(yy, 0), height - 1);
                const idx = (clampedY * width + clampedX) * 4;
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
    ctx.putImageData(resultImageData, 0, 0);
}
const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

let renderStartX;
let renderStartY;
let renderEndX;
let renderEndY;
let lastIndex = 0;

const GRID_SIZE = 9; // 9x9 격자
// 각 격자 중심에 대한 변위 벡터 표시 함수 수정
function renderGridToCanvas(canvas, ctx) {
    const width = canvas.width;
    const height = canvas.height;
    const gridWidth = Math.floor(width / GRID_SIZE);
    const gridHeight = Math.floor(height / GRID_SIZE);

    //console.log(displaceX)
    // 헬퍼 캔버스 컨텍스트로 그리기
    ctx.clearRect(0, 0, helper_canvas.width, helper_canvas.height); // 이전 그리기 지우기

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const centerX = x * gridWidth + gridWidth / 2;
            const centerY = y * gridHeight + gridHeight / 2;

            // 각 격자 중심에 대한 변위 벡터 계산
            const index = y * GRID_SIZE + x;
            const displacementX = displaceX[index];
            const displacementY = displaceY[index];

            // 격자 그리기
            ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
            ctx.strokeRect(
                x * gridWidth,
                y * gridHeight,
                gridWidth,
                gridHeight,
            );

            // 변위 벡터 텍스트 표시
            ctx.fillStyle = "black";
            ctx.font = "20px Arial";
            // 첫 번째 줄: X 값
            ctx.fillText(
                `X: ${(displacementX + x).toFixed(3)}`,
                centerX - 40,
                centerY - 24, // Y 위치를 조금 위로 조정
            );

            // 두 번째 줄: Y 값
            ctx.fillText(
                `Y: ${(displacementY + y).toFixed(3)}`,
                centerX - 40,
                centerY, // Y 위치를 조금 아래로 조정
            );

            ctx.font = "12px Arial";
            ctx.fillText(
                `X: ${displacementX.toFixed(3)}`,
                centerX - 40,
                centerY + 24, // Y 위치를 조금 위로 조정
            );
            // 두 번째 줄: Y 값
            ctx.fillText(
                `Y: ${displacementY.toFixed(3)}`,
                centerX - 40,
                centerY + 36, // Y 위치를 조금 아래로 조정
            );
        }
    }
}
// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("mini.png"); // 프로젝트 폴더 내 image.jpg 경로
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

    const { clientX, clientY } = event;
    console.log(clientX / 100 - 0.5, clientY / 100 - 0.5);
});

// 마우스 움직임 기록
document.addEventListener("mousemove", (event) => {
    if (isTracking) {
        const { clientX, clientY } = event;

        // 현재 좌표를 배열에 저장
        positions.push({ x: clientX / 100 - 0.5, y: clientY / 100 - 0.5 });

        if (positions.length < 2) {
            return;
        }

        lastIndex = positions.length - 1;
        const start = positions[lastIndex - 1];
        const end = positions[lastIndex];

        applyPixelFlow(canvas, start, end);

        renderToImage(canvas);
        renderGridToCanvas(helper_canvas, helper_ctx);
    }
});

// 스페이스바 뗐을 때 추적 종료 및 로그 출력
document.addEventListener("pointerup", (event) => {
    isTracking = false;
    console.log("Tracking 종료. 기록된 좌표:");
});

const helper_canvas = document.getElementById("helper-canvas");
const helper_ctx = helper_canvas.getContext("2d");

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

    // helper_canvas의 실제 크기를 canvas와 동일하게 설정
    helper_canvas.width = `${canvas.width * 100}`; // 100배 확대 (예시)
    helper_canvas.height = `${canvas.height * 100}`; // 100배 확대 (예시)

    ctx.drawImage(img, 0, 0);
}
