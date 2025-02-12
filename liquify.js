export class Liquify {
  constructor(canvas, ctx) {
    // 원본 이미지 데이터 가져오기
    let c_width = canvas.width;
    let c_height = canvas.height;
    this.originalImageData = ctx.getImageData(0, 0, c_width, c_height);
    this.originalData = this.originalImageData.data;

    // 변위 맵 초기화
    this.displaceMap = new Float32Array(2 * c_width * c_height);

    this.canvas = canvas;
    this.ctx = ctx;
    this.c_width = c_width;
    this.c_height = c_height;
    this.init();
  }
  async init() {
    await loadPrecomputedData("/data.bin");
    await loadPrecomputedData2("/integralEase.bin");
  }

  setRadius(radius) {
    this.radius = radius; // 뒤틀기 효과 반경
  }

  setStrength(strength) {
    this.strength = strength; // 강도
  }
  apply(start, end) {
    applyPixelFlow(
      this.displaceMap,
      start,
      end,
      this.radius,
      this.strength,
      this.c_width,
      this.c_height,
    );
  }

  renderToImage(minX, minY, maxX, maxY) {
    const c_width = this.c_width;
    const c_height = this.c_height;
    const ceiledRadius = Math.ceil(this.radius);

    const sx = Math.max(0, minX - ceiledRadius);
    const sy = Math.max(0, minY - ceiledRadius);
    const ex = Math.min(c_width - 1, maxX + ceiledRadius);
    const ey = Math.min(c_height - 1, maxY + ceiledRadius);

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

        const totalDx = this.displaceMap[2 * index];
        const totalDy = this.displaceMap[2 * index + 1];
        let newX = x + totalDx;
        let newY = y + totalDy;

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
          //화면 밖이면 투명으로 설정
          if (xx < 0 || xx >= c_width || yy < 0 || yy >= c_height) {
            return [
              this.originalData[idx],
              this.originalData[idx + 1],
              this.originalData[idx + 2],
              0,
            ];
          }

          return [
            this.originalData[idx],
            this.originalData[idx + 1],
            this.originalData[idx + 2],
            this.originalData[idx + 3],
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
    this.ctx.putImageData(resultImageData, sx, sy);
  }
}

function applyPixelFlow(
  displaceMap,
  start,
  end,
  radius,
  force,
  c_width,
  c_height,
) {
  const ceiledRadius = Math.ceil(radius);

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

  let area = generateCylinderCut(end.x - start.x, end.y - start.y, radius);

  for (let i = 0; i < gridHeight - 1; i++) {
    const y = unitY > 0 ? startY + gridHeight - 1 - i : startY + i;
    const areaY = unitY > 0 ? gridHeight - 1 - i : i;
    for (let j = 0; j < gridWidth - 1; j++) {
      const x = unitX > 0 ? startX + gridWidth - 1 - j : startX + j;
      const areaX = unitX > 0 ? gridWidth - 1 - j : j;

      if (0 <= x && x < c_width && 0 <= y && y < c_height) {
        const index = y * c_width + x;

        //areaMap[i][j] = area[areaY][areaX];
        let diff = (area[areaY][areaX] * force) / 2;

        //console.log("@", areaX, areaY, "*", `(${x}, ${y})`);
        let result = fastGetVector(
          displaceMap,
          c_width,
          c_height,
          x - diff * unitX,
          y - diff * unitY,
        );
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


const vectorResult = [0, 0];
// 이게 1.3배 더 빠름
function fastGetVector(displaceMap, c_width, c_height, x, y) {
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
        let gradation = (radius + t) / radius / 2;
        grid[y][x] -= orginalCell * (1 - easeInOutCubicIntegralReal(gradation));
      }

      if (eLength < radius) {
        let gradation = (radius + length - t) / radius / 2;
        grid[y][x] -= orginalCell * (1 - easeInOutCubicIntegralReal(gradation));
      }
    }
  }
  return grid;
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

  return precomputed2[lowerIndex] * (1 - t) + precomputed2[upperIndex] * t;
}
