// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let c_width;
let c_height;
let originalImageData;
let originalData;

//let displaceX;
//let displaceY;
let displaceMap;

const EFFECT_RADIUS = 40; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도

function initPixelFlow(ctx, width, height) {
    // 원본 이미지 데이터 가져오기
    originalImageData = ctx.getImageData(0, 0, width, height);
    originalData = originalImageData.data;

    // 변위 맵 초기화
    //displaceX = new Float32Array(width * height);
    // displaceY = new Float32Array(width * height);
    displaceMap = new Float32Array(2 * width * height);
}

function applyPixelFlow(start, end, force) {
    let area = generateGradientGrid(
        end.x - start.x,
        end.y - start.y,
        EFFECT_RADIUS,
    );
    const ceiledRadius = Math.ceil(EFFECT_RADIUS);

    let minX = Math.min(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let gridWidth = Math.abs(end.x - start.x) + 1 + 2 * ceiledRadius;
    let gridHeight = Math.abs(end.y - start.y) + 1 + 2 * ceiledRadius;

    //console.log(gridWidth, gridHeight);
    let startX = minX - ceiledRadius;
    let startY = minY - ceiledRadius;

    // end는 방향 계산용으로만 사용
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const unitX = dx / length;
    const unitY = dy / length;

    for (let i = 0; i < gridHeight - 1; i++) {
        const y = unitY > 0 ? startY + gridHeight - 1 - i : startY + i;
        const areaY = unitY > 0 ? gridHeight - 1 - i : i;
        for (let j = 0; j < gridWidth - 1; j++) {
            const x = unitX > 0 ? startX + gridWidth - 1 - j : startX + j;
            const areaX = unitX > 0 ? gridWidth - 1 - j : j;

            if (0 <= x && x < c_width && 0 <= y && y < c_height) {
                const index = y * c_width + x;

                //areaMap[i][j] = area[areaY][areaX];
                let diff = (area[areaY][areaX] * MAGNIFY_STRENGTH * force) / 2;

                //console.log("@", areaX, areaY, "*", `(${x}, ${y})`);
                let result = fastGetVector(x - diff * unitX, y - diff * unitY);
                let ax = result[0];
                let ay = result[1];

                //displaceX[index] = ax - diff * unitX;
                // displaceY[index] = ay - diff * unitY;
                displaceMap[2 * index] = ax - diff * unitX;
                displaceMap[2 * index + 1] = ay - diff * unitY;
            }
        }
    }
}

function createEffectArea(effectRadius) {
    // effectRadius를 올림하여 정수 반지름 계산
    let ceiledRadius = Math.ceil(effectRadius);
    // 배열 크기 계산 (항상 홀수 크기 유지)
    const size = 2 * ceiledRadius + 1;
    const center = Math.floor(size / 2);

    // 2D 배열 초기화
    const result = Array.from({ length: size }, () => Array(size).fill(0));

    // 각 픽셀에 대해 거리 계산 후 값 할당
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // 중심점과의 거리 계산
            const distance = Math.hypot(x - center, y - center);

            // 반지름 내에 있는 경우만 값 할당
            if (distance <= effectRadius) {
                result[y][x] = 1 - easeInOutCubic(distance / effectRadius);
            }
        }
    }

    return result;
}

const easeInOutCubic = (x) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const clamp = (value, min, max) =>
    value < min ? min : value > max ? max : value;

function getVector(x, y) {
    // x, y 좌표의 네 개의 인접 픽셀을 찾음
    const x1 = Math.floor(x);
    const x2 = Math.ceil(x);
    const y1 = Math.floor(y);
    const y2 = Math.ceil(y);

    // 네 개의 픽셀 값 가져오기
    const Q11 = getDisplaceData(x1, y1); // 좌상단
    const Q21 = getDisplaceData(x2, y1); //[y1][x2]; // 우상단
    const Q12 = getDisplaceData(x1, y2); //[y2][x1]; // 좌하단
    const Q22 = getDisplaceData(x2, y2); //[y2][x2]; // 우하단

    // 보간 비율 계산
    const dx = x - x1; // x에 대한 가중치
    const dy = y - y1; // y에 대한 가중치
    let result = interpolateXY(Q11, Q21, Q12, Q22, dx, dy);
    return result;
}

function getDisplaceData(xx, yy) {
    const clampedX = clamp(xx, 0, c_width - 1);
    const clampedY = clamp(yy, 0, c_height - 1);
    const idx = clampedY * c_width + clampedX;
    //let disX = displaceX[idx];
    //let disY = displaceY[idx];
    let disX = displaceMap[2 * idx];
    let disY = displaceMap[2 * idx + 1];
    return [disX, disY];
}

function interpolateXY(Q11, Q21, Q12, Q22, dx, dy) {
    const invDx = 1 - dx,
        invDy = 1 - dy;

    return [
        Q11[0] * invDx * invDy +
            Q21[0] * dx * invDy +
            Q12[0] * invDx * dy +
            Q22[0] * dx * dy,
        Q11[1] * invDx * invDy +
            Q21[1] * dx * invDy +
            Q12[1] * invDx * dy +
            Q22[1] * dx * dy,
    ];
}

const vectorResult = [0, 0];
// 이게 1.3배 더 빠름
function fastGetVector(x, y) {
    // 지역 변수에 글로벌 상수를 캐싱 (최적화에 도움)
    const w = c_width;
    const h = c_height;

    // x, y의 정수 부분 계산 (하나의 호출로 두 번 쓰임)
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    // 원래 코드는 Math.ceil(x)로 x2, y2를 구했지만,
    // 일반적으로 bilinear interpolation에서는 x2 = x1 + 1, y2 = y1 + 1로 처리하는 경우가 많음.
    // (만약 x, y가 정수일 경우 보간에 사용하지 않으려면 추가 처리가 필요함)
    const x2 = x1 + 1;
    const y2 = y1 + 1;

    // 좌표 클램핑 (inline clamp)
    const cx1 = x1 < 0 ? 0 : x1 >= w ? w - 1 : x1;
    const cx2 = x2 < 0 ? 0 : x2 >= w ? w - 1 : x2;
    const cy1 = y1 < 0 ? 0 : y1 >= h ? h - 1 : y1;
    const cy2 = y2 < 0 ? 0 : y2 >= h ? h - 1 : y2;

    // 인덱스 계산 (지역 변수 w 사용)
    const idx11 = cy1 * w + cx1;
    const idx21 = cy1 * w + cx2;
    const idx12 = cy2 * w + cx1;
    const idx22 = cy2 * w + cx2;

    // 배열에서 픽셀 데이터 읽어오기 (분리된 x, y 값)
    // const Q11x = displaceX[idx11],
    //     Q11y = displaceY[idx11];
    // const Q21x = displaceX[idx21],
    //     Q21y = displaceY[idx21];
    // const Q12x = displaceX[idx12],
    //     Q12y = displaceY[idx12];
    // const Q22x = displaceX[idx22],
    //     Q22y = displaceY[idx22];
    const Q11x = displaceMap[2 * idx11],
        Q11y = displaceMap[2 * idx11 + 1];
    const Q21x = displaceMap[2 * idx21],
        Q21y = displaceMap[2 * idx21 + 1];
    const Q12x = displaceMap[2 * idx12],
        Q12y = displaceMap[2 * idx12 + 1];
    const Q22x = displaceMap[2 * idx22],
        Q22y = displaceMap[2 * idx22 + 1];

    // 보간 비율 계산
    // x1, y1는 Math.floor(x), Math.floor(y)이므로
    // dx, dy는 소수 부분이 됨.
    const dx = x - x1;
    const dy = y - y1;
    const invDx = 1 - dx;
    const invDy = 1 - dy;

    // bilinear interpolation (각 성분 별로 계산)
    vectorResult[0] =
        Q11x * invDx * invDy +
        Q21x * dx * invDy +
        Q12x * invDx * dy +
        Q22x * dx * dy;

    vectorResult[1] =
        Q11y * invDx * invDy +
        Q21y * dx * invDy +
        Q12y * invDx * dy +
        Q22y * dx * dy;

    return vectorResult;
}

function renderToImage(sx, sy, ex, ey) {
    const width = ex - sx + 1; // 시작: 5, 끝: 9이면 5 6 7 8 9, 총 길이 5임
    const height = ey - sy + 1;

    // 잘못된 영역이면 그냥 종료합니다.
    if (width <= 0 || height <= 0) {
        return;
    }

    const newImageData = new Uint8ClampedArray(width * height * 4);

    let imageIndex = 0;
    for (let y = sy; y <= ey; y++) {
        for (let x = sx; x <= ex; x++) {
            const index = y * c_width + x;

            const totalDx = displaceMap[2 * index];
            const totalDy = displaceMap[2 * index + 1];
            let newX = x + totalDx;
            let newY = y + totalDy;

            // 좌표를 이미, � 경계 내로 클램핑
            // 이걸 주석하면 더욱더 바깥 색을 잘 표현함. 아마?
            // newX = Math.min(Math.max(newX, 0), canvas_w - 1);
            // newY = Math.min(Math.max(newY, 0), canvas_h - 1);

            // 양선형 보간
            const floorX = Math.floor(newX);
            const floorY = Math.floor(newY);
            const ceilX = Math.ceil(newX);
            const ceilY = Math.ceil(newY);
            const tx = newX - floorX;
            const ty = newY - floorY;

            const getColor = (xx, yy) => {
                // 클램핑된 좌표를 사용
                const clampedX = clamp(xx, 0, c_width - 1);
                const clampedY = clamp(yy, 0, c_height - 1);
                const idx = (clampedY * c_width + clampedX) * 4;
                // 화면 밖이면 투명으로 설정
                //     if (xx < 0 || xx >= canvas_w || yy < 0 || yy >= canvas_h) {
                //         return [
                //             originalData[idx],
                //                 originalData[idx + 1],
                //                 originalData[idx + 2],
                //             0,
                //         ];
                //     }

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
            const newIndex = imageIndex * 4;
            newImageData[newIndex] = r;
            newImageData[newIndex + 1] = g;
            newImageData[newIndex + 2] = b;
            newImageData[newIndex + 3] = a;

            imageIndex++;
        }
    }

    let resultImageData = new ImageData(newImageData, width, height);
    ctx.putImageData(resultImageData, sx, sy);
}

function generateGradientGrid(dx, dy, radius) {
    const length = Math.hypot(dx, dy);

    if (length === 0) return;

    const ceiledRadius = Math.ceil(radius);

    const width = Math.abs(dx) + 2 * ceiledRadius + 1;
    const height = Math.abs(dy) + 2 * ceiledRadius + 1;

    let startX = ceiledRadius;
    let startY = ceiledRadius;
    let endX = width - 1 - ceiledRadius;
    let endY = height - 1 - ceiledRadius;

    const unitX = dx / length;
    const unitY = dy / length;

    // 2D 배열 초기화
    let grid = Array.from({ length: height }, () => Array(width).fill(0));

    // 원의 이동 경로를 따라 값 추가
    // t는 나누기 오류때문에 약간 보정
    let steps = 50; // 이건 무조건 정수로!!
    let div = steps / length;
    for (let t = 0; t <= 1.001; t += 1 / steps) {
      const cx = unitX > 0 ? startX + t * dx : endX + t * dx;
      const cy = unitY > 0 ? startY + t * dy : endY + t * dy;

      //console.log(cx, cy);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const d = Math.hypot(x - cx, y - cy);
          const value = Math.max(0, 1 - d / radius);
          grid[y][x] += value / div; // 누적
        }
      }
    }

    return grid;
  }
// 마우스 위치를 저장할 배열
let positions = [];
let isTracking = false; // 누름 상태
let count = 0;
let lastIndex = 0;

let liquify;

// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check.png");
        //const img = await loadImageFromURL("cat.webp");
        //const img = await loadImageFromURL("musk.png");
        drawImageToCanvas(img);

        //liquify = makeLiquify(canvas, ctx);
        initPixelFlow(ctx, c_width, c_height);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
};

document.addEventListener("pointerdown", (event) => {
    isTracking = true;
    positions = []; // 이전 데이터 초기화
    lastIndex = 0;
    count = 0;
    const { clientX, clientY } = event;
    //let area = createEffectArea(EFFECT_RADIUS);

    //console.table(area.map((row) => row.map((v) => v.toFixed(2))));
    // console.table(grid.map((row) => row.map((v) => v.toFixed(2))));
    // applyPixelFlow(
    //     { x: ~~clientX, y: ~~clientY },
    //     { x: ~~clientX - 100, y: ~~clientY - 100 },
    //     area,
    //     1,
    // );

    // applyPixelFlow(point, end, area, tap);
    //renderToImage(0, 0, canvas.width, canvas.height);

    // let index = ~~clientY * c_width + ~~clientX;

    // console.log(
    //     `(${~~clientX}, ${~~clientY})`,
    //     ",",
    //     displaceX[index],
    //     displaceY[index],
    // );
    //console.table(createEffectArea(5));
});

document.addEventListener("pointermove", (event) => {
    //return;
    if (!isTracking) {
        return;
    }

    const { clientX, clientY } = event;

    // 현재 좌표를 배열에 저장
    positions.push({ x: ~~clientX, y: ~~clientY });

    if (positions.length < 2) {
        return;
    }

    lastIndex = positions.length - 1;
    const start = positions[lastIndex - 1];
    const end = positions[lastIndex];

    applyPixelFlow(start, end, 1);

    // 선분의 최소/최대 좌표에 EFFECT_RADIUS를 고려한 바운딩 박스 계산
    let ceiledRadius = Math.ceil(EFFECT_RADIUS);

    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    const boundMinX = Math.max(0, minX - ceiledRadius);
    const boundMinY = Math.max(0, minY - ceiledRadius);
    const boundMaxX = Math.min(c_width - 1, maxX + ceiledRadius);
    const boundMaxY = Math.min(c_height - 1, maxY + ceiledRadius);

    renderToImage(boundMinX, boundMinY, boundMaxX, boundMaxY);

    //renderToImage( 0, 0, c_width, c_height);
});

document.addEventListener("pointerup", (event) => {
    isTracking = false;
    console.log("pointerup");
    //renderToImage( 0, 0, c_width, c_height);
});

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
    c_width = img.naturalWidth;
    c_height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
}
