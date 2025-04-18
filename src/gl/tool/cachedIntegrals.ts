let cacheIntegralEaseInOut: Float32Array | null = null;
let cacheIntegralEaseInOutMirror: Float32Array | null = null;

let integralBase64 =
    "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";

let IntegralEaseInOutMirrorBase64 =
    "AAAAALBquzS+7mU2wjKANxTJQDhVqeU4IddqOdqp1zk45TY6seKROiOw3To16yE7h+tkO2lunTv1gtM7KTwLPHkaNDxkYGU8UxGQPF3DsjxxYds8iEcFPQx8ID1nqD896ipjPbGshT0aJpw9feK0Payxzz2SZew9GWkFPtVmFT4VGCY+AWo3PslKST6tqVs+93ZuPv/RgD6RkYo+6nOUPkdznj5siqg+orSyPrntvD4GMsc+ZH7RPjfQ2z5kJeY+XHzwPhDU+j74lQI/0sEHP07tDD/lFxI/zkAXP/1mHD8kiSE/r6UmP8q6Kz9cxjA/C8Y1Pze3Oj8Blz8/QmJEP5UVST9OrU0/gCVSP/t5Vj9Lplo/uqVeP05zYj/LCWY/sGNpPz17bD9qSm8/Uc1xP3oFdD8/+HU/iKt3P/QkeT/laXo/dX97P35qfD+WL30/D9N9P/pYfj8jxX4/FBt/PxVefz8okX8/D7d/P0fSfz8L5X8/U/F/P9P4fz/9/H8/AP9/P8f/fz/6/38/AACAPw==";

function decodeBase64ToFloat32Array(base64) {
    const binary = atob(base64.replace(/\s+/g, ""));
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return new Float32Array(buffer.buffer);
}

/**
 * x가 0 이상 1 이하일 때,
 * I(x)= ∫₀¹ √((1-F(t))² - x²) dt 를 계산합니다.
 *
 **/
// F(x) = easeinoutCirc(x) 일 때
export async function getIntegralEaseInOut() {
   // console.log(edgeCutLookup())
   // return edgeCutLookup();
    // return new Float32Array([0.5,0.4,0.3,0.2,0.1,0]);
    if (cacheIntegralEaseInOut) {
        return cacheIntegralEaseInOut;
    }
    cacheIntegralEaseInOut = decodeBase64ToFloat32Array(integralBase64);

    return cacheIntegralEaseInOut;

    // const response1 = await fetch("/data.bin");
    // const arrayBuffer1 = await response1.arrayBuffer();
    // cacheIntegralEaseInOut = new Float32Array(arrayBuffer1);
    // return cacheIntegralEaseInOut;
}

function F(x) {
    return easeInOutSine(x)
}
function easeInOutSine(x: number): number {
return -(Math.cos(Math.PI * x) - 1) / 2;
}
const EDGE_GRID_SIZE = 20;          // x ∈ [0,1] 을 100등분
let edgeCutTable = null;             // 1‑차원 Float32Array (EDGE_GRID_SIZE)


/**
 * 단순 복합 사다리꼴 법칙으로 적분을 근사 계산합니다.
 * @param {Function} f    – t에 대한 함수
 * @param {number} a      – 하한
 * @param {number} b      – 상한
 * @param {number} steps  – 분할 수
 * @returns {number}
 */
function numericIntegrate(f, a, b, steps = 200) {
  if (b <= a) return 0;
  const h = (b - a) / steps;
  let sum = f(a) + f(b);
  for (let i = 1; i < steps; i++) {
    sum += 2 * f(a + i * h);
  }
  return (h / 2) * sum;
}

/* ----------  edgeCut 테이블 초기화 ---------- */
function initEdgeCutTable() {
  edgeCutTable = new Float32Array(EDGE_GRID_SIZE);

  for (let xi = 0; xi < EDGE_GRID_SIZE; xi++) {
    const x = xi / (EDGE_GRID_SIZE - 1);            // x ∈ [0,1]
    const upper = Math.sqrt(1 - x * x);             // √(1 - x²)
    edgeCutTable[xi] = numericIntegrate(
      t => F(1 - Math.hypot(x, t)),                 // F(1 - √(x² + t²))
      0,
      upper
    );
  }
}

/* ----------  edgeCut 값 조회 ---------- */
/**
 * edgeCutLookup(x)  →  ∫₀^(√(1-x²)) F(1-√(x²+t²)) dt
 * @param {number} x  0 ≤ x ≤ 1
 * @returns {number}
 */
function edgeCutLookup() {
  if (!edgeCutTable) initEdgeCutTable();

  return edgeCutTable;
}

/* ----------  사용 예시 ---------- */
// console.log(edgeCutLookup(0.0));   // x = 0  →  최대 적분 범위
// console.log(edgeCutLookup(0.7));   // x = 0.7

/**
 * F(x)를 뒤집어놓은 함수의 적분 0~x까지 가져옴
 */
export async function getIntegralEaseInOutMirror() {
    if (cacheIntegralEaseInOutMirror) {
        return cacheIntegralEaseInOutMirror;
    }
    cacheIntegralEaseInOutMirror = decodeBase64ToFloat32Array(
        IntegralEaseInOutMirrorBase64,
    );
    return cacheIntegralEaseInOutMirror;

    // const response2 = await fetch("/integralEase.bin");
    // const arrayBuffer2 = await response2.arrayBuffer();
    // cacheIntegralEaseInOutMirror = new Float32Array(arrayBuffer2);
    // return cacheIntegralEaseInOutMirror;
}
