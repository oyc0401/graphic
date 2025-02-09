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
  }

  setRadius(radius) {
    this.radius = radius; // 뒤틀기 효과 반경
    this.area = createEffectArea(radius);
  }

  setStrength(strength) {
    this.strength = strength; // 강도
  }
  applyPixelFlow(start, end, force) {
    // end는 방향 계산용으로만 사용
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const unitX = dx / length;
    const unitY = dy / length;
    const ceiledRadius = Math.ceil(this.radius);
    let areaLength = this.area.length;
    //console.log(start);
    let c_width = this.c_width;
    let c_height = this.c_height;

    for (let i = 0; i < areaLength - 1; i++) {
      const y =
        unitY > 0 ? start.y + ceiledRadius - i : start.y - ceiledRadius + i;
      const areaY = unitY > 0 ? areaLength - 1 - i : i;
      for (let j = 0; j < areaLength - 1; j++) {
        const x =
          unitX > 0 ? start.x + ceiledRadius - j : start.x - ceiledRadius + j;
        const areaX = unitX > 0 ? areaLength - 1 - j : j;

        if (0 <= x && x < c_width && 0 <= y && y < c_height) {
          const index = y * c_width + x;

          let diff = (this.area[areaY][areaX] * this.strength * force) / 2;

          //console.log("@", areaX, areaY, "*", `(${x}, ${y})`);
          let result = this.fastGetVector(x - diff * unitX, y - diff * unitY);
          let ax = result[0];
          let ay = result[1];

          this.displaceMap[2 * index] = ax - diff * unitX;
          this.displaceMap[2 * index + 1] = ay - diff * unitY;
        }
      }
    }
  }

  fastGetVector(x, y) {
    // 지역 변수에 글로벌 상수를 캐싱 (최적화에 도움)
    const w = this.c_width;
    const h = this.c_height;

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
    const Q11x = this.displaceMap[2 * idx11],
      Q11y = this.displaceMap[2 * idx11 + 1];
    const Q21x = this.displaceMap[2 * idx21],
      Q21y = this.displaceMap[2 * idx21 + 1];
    const Q12x = this.displaceMap[2 * idx12],
      Q12y = this.displaceMap[2 * idx12 + 1];
    const Q22x = this.displaceMap[2 * idx22],
      Q22y = this.displaceMap[2 * idx22 + 1];

    // 보간 비율 계산
    // x1, y1는 Math.floor(x), Math.floor(y)이므로
    // dx, dy는 소수 부분이 됨.
    const dx = x - x1;
    const dy = y - y1;
    const invDx = 1 - dx;
    const invDy = 1 - dy;

    // bilinear interpolation (각 성분 별로 계산)

    const vectorResult = [0, 0];
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
