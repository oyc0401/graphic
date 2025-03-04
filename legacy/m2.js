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

function applyPixelFlow(start, end, force = 1) {
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

    let area;
    // if (length > 2 * EFFECT_RADIUS) {
    //     area = generateCylinderCut(
    //         end.x - start.x,
    //         end.y - start.y,
    //         EFFECT_RADIUS,
    //     );
    // } else {
        area = generateCylinderCut(
            end.x - start.x,
            end.y - start.y,
            EFFECT_RADIUS,
        );
   // }

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
    let steps = Math.ceil(length) * 2; // 이건 무조건 정수로!!
    steps = 50;
    let div = steps / length;
    for (let t = 0; t <= 1.001; t += 1 / steps) {
        const cx = (unitX > 0 ? startX : endX) + t * dx;
        const cy = (unitY > 0 ? startY : endY) + t * dy;

        //console.log(cx, cy);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const d = Math.hypot(x - cx, y - cy);
                let value = Math.max(0, 1 - d / radius);
                const addValue = easeInOutCubic(value);
                grid[y][x] += addValue / div;
            }
        }
    }

    return grid;
}

const linear = (x) => x;

/**
   * 원기둥 자르기 기법으로 선분(dx, dy), 반경 radius인 캡슐 형태의 2D 그리드를 생성한다.
   *
   * @param {number} dx 선분의 x방향 길이
   * @param {number} dy 선분의 y방향 길이
   * @param {number} radius 캡슐 반경
   * @param {function} weightFunc (optional) 거리→가중치 함수, 기본값은 (1 - dist/r)
   * @returns {number[][]} 2차원 그리드 (height x width)
   */
  function generateCylinderCut(dx, dy, radius) {
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      // degenerate case: dx=dy=0
      return [[1]]; // 혹은 빈 배열 등 적절히 처리
    }

    // 캡슐을 모두 담을 수 있는 bounding box 계산
    const rCeil = Math.ceil(radius);
    const width = Math.abs(Math.floor(dx)) + 2 * rCeil + 1;
    const height = Math.abs(Math.floor(dy)) + 2 * rCeil + 1;

    // 결과 2D 배열 초기화
    const grid = Array.from({ length: height }, () => Array(width).fill(0));

    // 선분 방향 유닛벡터
    const ux = dx / length;
    const uy = dy / length;

    const startX = dx > 0 ? rCeil : width - 1 - rCeil;
    const startY = dy > 0 ? rCeil : height - 1 - rCeil;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 선분 시작점에서 (x, y)까지의 벡터
        const vx = x - startX;
        const vy = y - startY;

        // 해당 픽셀이 선분을 따라 가장 가까운 점의 t (0~length)를 구한다.
        // t = dot(v, u).  (u는 단위벡터)
        let t = vx * ux + vy * uy;

        // 선분 범위(0 <= t <= length) 바깥이면, 끝단(원) 부분이 됨
        //if (t < 0) t = 0;
        //if (t > length) t = length;

        // 선분 위 가장 가까운 점의 좌표(cx, cy)
        const cx = t * ux;
        const cy = t * uy;

        //const cx = (unitX > 0 ? startX : endX) + t * dx;
        //const cy = (unitY > 0 ? startY : endY) + t * dy;

        // (vx, vy) - (cx, cy) = 선분에서 수직 방향 벡터
        const dx2 = vx - cx;
        const dy2 = vy - cy;

        // 픽셀 (x, y)와 선분 사이의 최단거리
        const d = Math.hypot(dx2, dy2);

        let percent = 1; // Math.min(length, radius) / radius;

        if (0 < t && t < length) {
          let value = Math.min(1, d / radius);
          const addValue = easeInOutCubicIntegral(value);
          grid[y][x] = addValue * radius * 2 * percent;
        }

        // // 시작점, 끝점 반경 원
        let vLength = Math.hypot(vx, vy);
        let ex = vx - dx; // 끝점에서 해당 좌표까지의 벡터
        let ey = vy - dy;
        let eLength = Math.hypot(ex, ey);

        // if (vLength < radius || eLength < radius) {
        //   let value = Math.min(1, d / radius);
        //   const addValue = easeInOutCubicIntegral(value);
        //   grid[y][x] = addValue * radius * 2;
        // }

        if (vLength < radius) {
          let value = Math.min(1, d / radius);
          const addValue = easeInOutCubicIntegral(value);
          grid[y][x] = addValue * radius * 2 * percent;

          let gradation = (radius + t) / radius / 2;
          // grid[y][x] *= easeInOutCubicIntegralReal(gradation);
        }

        if (eLength < radius) {
          let value = Math.min(1, d / radius);
          const addValue = easeInOutCubicIntegral(value);
          grid[y][x] = addValue * radius * 2 * percent;

          let gradation = (radius + length - t) / radius / 2;
          // grid[y][x] *= gradation;
        }
        let orginalCell = grid[y][x];

        if (vLength < radius) {
          let gradation = ((radius + t) / radius / 2);
          grid[y][x] -= orginalCell * (1-easeInOutCubicIntegralReal(gradation));
        }

        if (eLength < radius) {
          let gradation = (radius + length - t) / radius / 2;
          grid[y][x] -= orginalCell * (1-easeInOutCubicIntegralReal(gradation));
        }
      }
    }
    return grid;
  }

  /**
   * x가 0 이상 1 이하일 때,
   * I(x)= ∫₀¹ √((1-F(t))² - x²) dt 를 계산합니다.
   **/
  // F(t) = 0일때.
  function flatIntegral(x) {
    return Math.sqrt(1 - Math.pow(x, 2));
  }

  // F(t) = t일때.
  function linearIntegral(x) {
    if (x < 0 || x > 1) {
      throw new Error("x는 0과 1 사이여야 합니다.");
    }
    // x = 0일 때 별도로 처리 (로그 계산 시 0이 되지 않도록)
    if (x === 0) {
      return 0.5; // I(0) = ∫₀¹ (1-t) dt = 1/2
    }

    const sqrtTerm = Math.sqrt(1 - x * x);
    return 0.5 * sqrtTerm + 0.5 * x * x * Math.log(x / (1 + sqrtTerm));
  }

  // 전역 변수: 미리 계산된 적분값을 저장할 배열
  let precomputed = null;

  // bin 파일을 불러와 `Float32Array`로 변환하는 함수
  async function loadPrecomputedData(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      console.log("ArrayBuffer 크기:", arrayBuffer.byteLength, "바이트");

      const dataView = new DataView(arrayBuffer);
      const numValues = arrayBuffer.byteLength / 4; // Float32는 4바이트
      precomputed = new Float32Array(numValues);

      for (let i = 0; i < numValues; i++) {
        precomputed[i] = dataView.getFloat32(i * 4, true); // 리틀 엔디언으로 읽기
      }

      console.log("Float32Array 길이:", precomputed.length);
      console.log(precomputed.slice(0, 10)); // ✅ 일부 값 확인

      console.log("✅ Precomputed I(x) 데이터 로드 완료!");
    } catch (error) {
      console.error("❌ 데이터 로드 실패:", error);
    }
  }

  // easeInOutCubicIntegral(x) 함수
  function easeInOutCubicIntegral(x) {
    if (precomputed == null) {
      console.warn("❌ 데이터가 아직 로드되지 않았습니다!");
      return 0;
    }

    // x가 범위를 벗어나면 경계값 반환
    if (x <= 0) return precomputed[0];
    if (x >= 1) return precomputed[precomputed.length - 1];

    const numSamples = precomputed.length;
    const index = x * (numSamples - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = lowerIndex + 1;
    const t = index - lowerIndex; // 선형 보간 가중치

    return precomputed[lowerIndex] * (1 - t) + precomputed[upperIndex] * t;
  }

  let precomputed2 = null;

  // bin 파일을 불러와 `Float32Array`로 변환하는 함수
  async function loadPrecomputedData2(url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      console.log("ArrayBuffer 크기:", arrayBuffer.byteLength, "바이트");

      const dataView = new DataView(arrayBuffer);
      const numValues = arrayBuffer.byteLength / 4; // Float32는 4바이트
      precomputed2 = new Float32Array(numValues);

      for (let i = 0; i < numValues; i++) {
        precomputed2[i] = dataView.getFloat32(i * 4, true); // 리틀 엔디언으로 읽기
      }

      console.log("Float32Array 길이:", precomputed2.length);
      console.log(precomputed2.slice(0, 10)); // ✅ 일부 값 확인

      console.log("✅ Precomputed2 I(x) 데이터 로드 완료!");
    } catch (error) {
      console.error("❌ 데이터 로드 실패:", error);
    }
  }
  function easeInOutCubicIntegralReal(x) {
    if (precomputed2 == null) {
      console.warn("❌ 데이터가 아직 로드되지 않았습니다!");
      return 0;
    }

    // x가 범위를 벗어나면 경계값 반환
    if (x <= 0) return precomputed2[0];
    if (x >= 1) return precomputed2[precomputed2.length - 1];

    const numSamples = precomputed2.length;
    const index = x * (numSamples - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = lowerIndex + 1;
    const t = index - lowerIndex; // 선형 보간 가중치

    return (
      precomputed2[lowerIndex] * (1 - t) + precomputed2[upperIndex] * t
    );
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
        const url = "/data.bin";
        await loadPrecomputedData(url);
           await loadPrecomputedData2("/integralEase.bin");
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
