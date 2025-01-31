
// ---------------------------------------------------------
// 설정값 및 유틸리티 함수
// ---------------------------------------------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// 작은 절대값을 선택하는 함수 (현재 사용되지 않음)
const smallerAbs = (a, b) => (Math.abs(a) < Math.abs(b) ? a : b);

// ---------------------------------------------------------
// MESH INITIALIZATION
// ---------------------------------------------------------
let meshGrid = [];  // 메시 전체를 관리할 전역 변수
let meshCols = 0;
let meshRows = 0;
let gridSize = 1;  // 기본 16픽셀 간격 (더 부드러운 변형을 위해 16으로 설정)

// 메시 초기화 함수
function initLiquifyMesh(canvas, grid = 16) {
    gridSize = grid;
    const width = canvas.width;
    const height = canvas.height;

    // 가로, 세로 그리드 개수
    meshCols = Math.ceil(width / gridSize);
    meshRows = Math.ceil(height / gridSize);

    // meshGrid[row][col] = { x: 현재 x, y: 현재 y, ox: 원본 x, oy: 원본 y }
    meshGrid = [];
    for (let row = 0; row <= meshRows; row++) {
        const rowData = [];
        for (let col = 0; col <= meshCols; col++) {
            const x = col * gridSize;
            const y = row * gridSize;
            rowData.push({
                x: x,      // 현재 변형된 위치
                y: y,
                ox: x,     // 원본 위치(초기값)
                oy: y,
            });
        }
        meshGrid.push(rowData);
    }
}

// ---------------------------------------------------------
// APPLY WARP TO MESH
// ---------------------------------------------------------
function applyLiquifyWarp(pointerX, pointerY, prevX, prevY, radius, strength) {
    // 드래그 벡터
    const dx = pointerX - prevX;
    const dy = pointerY - prevY;
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    for (let row = 0; row <= meshRows; row++) {
        for (let col = 0; col <= meshCols; col++) {
            const point = meshGrid[row][col];
            const distX = point.x - prevX;
            const distY = point.y - prevY;
            const dist = Math.sqrt(distX * distX + distY * distY);

            if (dist < radius) {
                // dist가 작을수록(드래그 중심에 가까울수록) 이동량을 크게
                const falloff = 1 - (dist / radius); // 0 ~ 1
                // 가우시안 falloff 적용 (더 부드러운 영향)
                const sigma = radius / 2;
                const gaussianFalloff = Math.exp(-(dist * dist) / (2 * sigma * sigma));
                // 강도와 falloff, 그리고 드래그 벡터를 곱해서 이동
                point.x -= dx * strength * gaussianFalloff;
                point.y -= dy * strength * gaussianFalloff;
            }
        }
    }
}

// ---------------------------------------------------------
// RENDER MESH-WARPED IMAGE
// ---------------------------------------------------------
function renderLiquifyMesh(ctx, originalImageData, meshGrid) {
    const { width, height } = ctx.canvas;

    // 결과 이미지를 담을 배열
    const outputData = new Uint8ClampedArray(width * height * 4);

    // 원본 이미지 데이터 접근용
    const srcData = originalImageData.data;
    const srcWidth = originalImageData.width;
    const srcHeight = originalImageData.height;

    // 그리드 크기
    const grid = gridSize;

    // 각 픽셀에 대해 메시 사각형(quad)에 속하는지 찾고, 역매핑
    for (let py = 0; py < height; py++) {
        // 메시 내에서 y축 비율
        let rowIndex = Math.floor(py / grid);
        rowIndex = Math.min(rowIndex, meshRows - 1); // 범위 제한

        const rowYStart = rowIndex * grid;
        const v = (py - rowYStart) / grid; // 0~1

        for (let px = 0; px < width; px++) {
            // 메시 내에서 x축 비율
            let colIndex = Math.floor(px / grid);
            colIndex = Math.min(colIndex, meshCols - 1);

            const colXStart = colIndex * grid;
            const u = (px - colXStart) / grid; // 0~1

            // 현재 quad의 4개 꼭짓점:
            const p00 = meshGrid[rowIndex][colIndex];
            const p01 = meshGrid[rowIndex][colIndex + 1];
            const p10 = meshGrid[rowIndex + 1][colIndex];
            const p11 = meshGrid[rowIndex + 1][colIndex + 1];

            // 각 꼭짓점의 displacement 벡터
            const dx00 = p00.x - p00.ox;
            const dy00 = p00.y - p00.oy;
            const dx01 = p01.x - p01.ox;
            const dy01 = p01.y - p01.oy;
            const dx10 = p10.x - p10.ox;
            const dy10 = p10.y - p10.oy;
            const dx11 = p11.x - p11.ox;
            const dy11 = p11.y - p11.oy;

            // Bilinear interpolation for displacement
            const dispXTop = dx00 * (1 - u) + dx01 * u;
            const dispXBtm = dx10 * (1 - u) + dx11 * u;
            const finalDispX = dispXTop * (1 - v) + dispXBtm * v;

            const dispYTop = dy00 * (1 - u) + dy01 * u;
            const dispYBtm = dy10 * (1 - u) + dy11 * u;
            const finalDispY = dispYTop * (1 - v) + dispYBtm * v;

            // 원본 좌표 계산 (변위 방향 수정)
            const srcX = px + finalDispX; // 수정된 부분
            const srcY = py + finalDispY; // 수정된 부분

            // 원본 좌표가 이미지 범위를 벗어나면 클램핑
            const clampedSrcX = Math.max(0, Math.min(srcX, srcWidth - 1));
            const clampedSrcY = Math.max(0, Math.min(srcY, srcHeight - 1));

            // 원본 이미지에서 해당 위치의 색상을 bilinear로 샘플링
            const color = sampleBilinear(srcData, srcWidth, srcHeight, clampedSrcX, clampedSrcY);

            // outputData에 기록
            const dstIndex = (py * width + px) * 4;
            outputData[dstIndex + 0] = color[0];
            outputData[dstIndex + 1] = color[1];
            outputData[dstIndex + 2] = color[2];
            outputData[dstIndex + 3] = color[3];
        }
    }

    // 최종 outputData를 ImageData로 만들어 캔버스에 출력
    const finalImageData = new ImageData(outputData, width, height);
    ctx.putImageData(finalImageData, 0, 0);
}

// 양선형 보간으로 이미지에서 (x, y) 위치의 색상을 구한다.
function sampleBilinear(srcData, srcWidth, srcHeight, x, y) {
    // 범위 넘어가면 클램핑
    x = Math.max(0, Math.min(x, srcWidth - 1));
    y = Math.max(0, Math.min(y, srcHeight - 1));

    // 정수, 소수 분리
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, srcWidth - 1);
    const y1 = Math.min(y0 + 1, srcHeight - 1);

    const dx = x - x0;
    const dy = y - y0;

    // 4개 꼭짓점 인덱스
    const i00 = (y0 * srcWidth + x0) * 4;
    const i01 = (y0 * srcWidth + x1) * 4;
    const i10 = (y1 * srcWidth + x0) * 4;
    const i11 = (y1 * srcWidth + x1) * 4;

    // bilinear
    const r00 = srcData[i00 + 0], g00 = srcData[i00 + 1], b00 = srcData[i00 + 2], a00 = srcData[i00 + 3];
    const r01 = srcData[i01 + 0], g01 = srcData[i01 + 1], b01 = srcData[i01 + 2], a01 = srcData[i01 + 3];
    const r10 = srcData[i10 + 0], g10 = srcData[i10 + 1], b10 = srcData[i10 + 2], a10 = srcData[i10 + 3];
    const r11 = srcData[i11 + 0], g11 = srcData[i11 + 1], b11 = srcData[i11 + 2], a11 = srcData[i11 + 3];

    const r0 = r00 * (1 - dx) + r01 * dx;
    const g0 = g00 * (1 - dx) + g01 * dx;
    const b0 = b00 * (1 - dx) + b01 * dx;
    const a0 = a00 * (1 - dx) + a01 * dx;

    const r1 = r10 * (1 - dx) + r11 * dx;
    const g1 = g10 * (1 - dx) + g11 * dx;
    const b1 = b10 * (1 - dx) + b11 * dx;
    const a1 = a10 * (1 - dx) + a11 * dx;

    const r = r0 * (1 - dy) + r1 * dy;
    const g = g0 * (1 - dy) + g1 * dy;
    const b = b0 * (1 - dy) + b1 * dy;
    const a = a0 * (1 - dy) + a1 * dy;

    return [r, g, b, a];
}

// ---------------------------------------------------------
// MESH RESET FUNCTION
// ---------------------------------------------------------
// 메시를 초기 상태로 리셋하는 함수
function resetMeshToOriginal() {
    for (let row = 0; row <= meshRows; row++) {
        for (let col = 0; col <= meshCols; col++) {
            const point = meshGrid[row][col];
            point.x = point.ox;
            point.y = point.oy;
        }
    }
    renderLiquifyMesh(ctx, originalImageData, meshGrid);
}

// ---------------------------------------------------------
// GET CANVAS COORDINATES FROM POINTER EVENT
// ---------------------------------------------------------
// 포인터 이벤트에서 캔버스 좌표를 얻는 함수
function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
}

// ---------------------------------------------------------
// IMAGE LOADING AND INITIALIZATION
// ---------------------------------------------------------
let originalImageData = null; // 원본 이미지 데이터 저장

// 초기화 (이미지 로드 후)
window.onload = async () => {
    try {
        const img = await loadImageFromURL("musk.png"); // 이미지 경로 수정 필요
        drawImageToCanvas(img);

        // "픽셀 유동화" 대신 "메시 기반 왜곡" 초기화
        initLiquifyMesh(canvas, gridSize); // gridSize=16 예시

        // 원본 이미지 데이터 캡처
        const width = canvas.width;
        const height = canvas.height;
        originalImageData = ctx.getImageData(0, 0, width, height);

        // 초기 메시는 원본 이미지 기준으로 리셋
        resetMeshToOriginal();

        console.log("초기화 완료");

    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
};

// 이미지 로드 함수
function loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // CORS 이슈 방지 (필요 시)
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("이미지 로드 실패"));
        img.src = url;
    });
}

// 이미지 캔버스에 그리기 함수
function drawImageToCanvas(img) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
}

// ---------------------------------------------------------
// POINTER EVENT HANDLERS
// ---------------------------------------------------------
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// 포인터/마우스 다운
document.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    const { x, y } = getCanvasCoordinates(e);
    lastX = x;
    lastY = y;
    console.log(`포인터 다운: (${x}, ${y})`);
});

// 포인터 이동
document.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;

    const { x, y } = getCanvasCoordinates(e);
    const pointerX = x;
    const pointerY = y;

    // 메시 왜곡 적용: 브러시 반경과 강도는 원하는 값으로 조절
    const radius = 80;    // 브러시 크기
    const strength = 0.5; // 이동 강도

    applyLiquifyWarp(pointerX, pointerY, lastX, lastY, radius, strength);

    lastX = pointerX;
    lastY = pointerY;

    // 매 프레임 그릴 때마다 메시 기반으로 이미지를 다시 렌더링
    // 성능 최적화를 위해 requestAnimationFrame 사용
    requestAnimationFrame(() => {
        renderLiquifyMesh(ctx, originalImageData, meshGrid);
    });

    // 디버깅: 메시 변형 확인
    // console.log(`메시 변형: (${pointerX}, ${pointerY})`);
});

// 포인터 업
document.addEventListener("pointerup", (e) => {
    isDrawing = false;
    console.log("포인터 업");
});

// 포인터가 캔버스를 벗어났을 때도 포인터 업 처리
document.addEventListener("pointerleave", (e) => {
    isDrawing = false;
    console.log("포인터 떠남");
});