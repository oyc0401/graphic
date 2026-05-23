export interface LiquifyLookup {
  primitive: Float32Array;
  primitiveWidth: number;
  primitiveHeight: number;
}

const KERNEL_SIZE = 256;
const PRIMITIVE_U_SIZE = 512;
const PRIMITIVE_X_SIZE = 512;
const SOLVE_SIZE = 256;
const SOLVE_U_SAMPLES = 768;
const SOLVE_SMOOTHNESS = 0.0002;
const SOLVE_CENTER_WEIGHT = 0;
const SOLVE_DIAGONAL_EPSILON = 1e-8;

let easeInOutLookupCache: LiquifyLookup | null = null;

function easeInOutSine(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function createEaseInOutTargetProfile(size: number) {
  const target = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const x = i / (size - 1);
    target[i] = easeInOutSine(1 - x);
  }

  return target;
}

function createTargetWeights(size: number) {
  const weights = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const x = i / (size - 1);
    weights[i] = 1 + SOLVE_CENTER_WEIGHT * Math.pow(1 - x, 4);
  }

  return weights;
}

function buildForwardMatrix(profileSize: number, kernelSize: number, uSamples: number) {
  const matrix: number[][] = Array.from({ length: profileSize }, () =>
    Array(kernelSize).fill(0),
  );

  for (let i = 0; i < profileSize; i++) {
    const x = i / (profileSize - 1);
    const maxU = Math.sqrt(Math.max(0, 1 - x * x));
    if (maxU === 0) continue;

    const du = maxU / uSamples;
    for (let sample = 0; sample < uSamples; sample++) {
      const u = (sample + 0.5) * du;
      const distance = Math.sqrt(x * x + u * u);
      const pos = distance * (kernelSize - 1);
      const left = Math.min(kernelSize - 1, Math.floor(pos));
      const right = Math.min(kernelSize - 1, left + 1);
      const t = pos - left;
      const weight = 2 * du;

      matrix[i][left] += weight * (1 - t);
      matrix[i][right] += weight * t;
    }
  }

  return matrix;
}

function resampleKernel(kernel: Float32Array, size: number) {
  const result = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    result[i] = sampleKernel(kernel, i / (size - 1));
  }

  return result;
}

function addSmoothnessRegularization(matrix: number[][], lambda: number) {
  for (let i = 1; i < matrix.length - 1; i++) {
    const indices = [i - 1, i, i + 1];
    const coefficients = [1, -2, 1];

    for (let row = 0; row < indices.length; row++) {
      for (let col = 0; col < indices.length; col++) {
        matrix[indices[row]][indices[col]] +=
          lambda * coefficients[row] * coefficients[col];
      }
    }
  }
}

function buildNormalEquation(
  matrix: number[][],
  target: Float32Array,
  weights: Float32Array,
) {
  const size = matrix[0].length;
  const normalMatrix: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(0),
  );
  const rhs = new Float32Array(size);

  for (let row = 0; row < matrix.length; row++) {
    const weight = weights[row];
    for (let col = 0; col < size; col++) {
      const weightedValue = matrix[row][col] * weight;
      rhs[col] += weightedValue * target[row];

      for (let otherCol = 0; otherCol < size; otherCol++) {
        normalMatrix[col][otherCol] += weightedValue * matrix[row][otherCol];
      }
    }
  }

  addSmoothnessRegularization(normalMatrix, SOLVE_SMOOTHNESS);
  for (let i = 0; i < size; i++) {
    normalMatrix[i][i] += SOLVE_DIAGONAL_EPSILON;
  }

  return { normalMatrix, rhs };
}

function solveLinearSystem(matrix: number[][], rhs: Float32Array) {
  const size = rhs.length;
  const solution = new Float32Array(size);
  const values = Array.from(rhs);

  for (let pivot = 0; pivot < size; pivot++) {
    let pivotRow = pivot;
    let pivotAbs = Math.abs(matrix[pivot][pivot]);

    for (let row = pivot + 1; row < size; row++) {
      const candidateAbs = Math.abs(matrix[row][pivot]);
      if (candidateAbs > pivotAbs) {
        pivotRow = row;
        pivotAbs = candidateAbs;
      }
    }

    if (pivotRow !== pivot) {
      const matrixRow = matrix[pivot];
      matrix[pivot] = matrix[pivotRow];
      matrix[pivotRow] = matrixRow;

      const value = values[pivot];
      values[pivot] = values[pivotRow];
      values[pivotRow] = value;
    }

    const pivotValue = matrix[pivot][pivot];
    if (Math.abs(pivotValue) < 1e-12) {
      continue;
    }

    for (let row = pivot + 1; row < size; row++) {
      const factor = matrix[row][pivot] / pivotValue;
      if (factor === 0) continue;

      matrix[row][pivot] = 0;
      for (let col = pivot + 1; col < size; col++) {
        matrix[row][col] -= factor * matrix[pivot][col];
      }
      values[row] -= factor * values[pivot];
    }
  }

  for (let row = size - 1; row >= 0; row--) {
    let sum = values[row];
    for (let col = row + 1; col < size; col++) {
      sum -= matrix[row][col] * solution[col];
    }

    const diagonal = matrix[row][row];
    solution[row] = Math.abs(diagonal) < 1e-12 ? 0 : sum / diagonal;
  }

  return solution;
}

function solveKernelForEaseInOutProfile() {
  const matrix = buildForwardMatrix(SOLVE_SIZE, SOLVE_SIZE, SOLVE_U_SAMPLES);
  const target = createEaseInOutTargetProfile(SOLVE_SIZE);
  const weights = createTargetWeights(SOLVE_SIZE);
  const { normalMatrix, rhs } = buildNormalEquation(matrix, target, weights);
  const kernel = solveLinearSystem(normalMatrix, rhs);

  return resampleKernel(kernel, KERNEL_SIZE);
}

function sampleKernel(kernel: Float32Array, normalizedDistance: number) {
  if (normalizedDistance <= 0) return kernel[0];
  if (normalizedDistance >= 1) return 0;

  const pos = normalizedDistance * (kernel.length - 1);
  const left = Math.floor(pos);
  const right = Math.min(kernel.length - 1, left + 1);
  const t = pos - left;

  return kernel[left] * (1 - t) + kernel[right] * t;
}

export function createLiquifyLookupFromKernel(kernel: Float32Array): LiquifyLookup {
  const primitive = new Float32Array(PRIMITIVE_U_SIZE * PRIMITIVE_X_SIZE);
  const profile = new Float32Array(PRIMITIVE_X_SIZE);

  for (let y = 0; y < PRIMITIVE_X_SIZE; y++) {
    const x = y / (PRIMITIVE_X_SIZE - 1);
    const maxU = Math.sqrt(Math.max(0, 1 - x * x));
    let sum = 0;

    primitive[y * PRIMITIVE_U_SIZE] = 0;
    for (let uIndex = 1; uIndex < PRIMITIVE_U_SIZE; uIndex++) {
      const prevU = Math.min((uIndex - 1) / (PRIMITIVE_U_SIZE - 1), maxU);
      const nextU = Math.min(uIndex / (PRIMITIVE_U_SIZE - 1), maxU);

      if (nextU > prevU) {
        const sampleU = (prevU + nextU) / 2;
        const distance = Math.sqrt(x * x + sampleU * sampleU);
        sum += sampleKernel(kernel, distance) * (nextU - prevU);
      }

      primitive[y * PRIMITIVE_U_SIZE + uIndex] = sum;
    }

    profile[y] = 2 * primitive[y * PRIMITIVE_U_SIZE + PRIMITIVE_U_SIZE - 1];
  }

  const normalization = profile[0] || 1;

  for (let i = 0; i < primitive.length; i++) {
    primitive[i] /= normalization;
  }
  for (let i = 0; i < profile.length; i++) {
    profile[i] /= normalization;
  }

  return {
    primitive,
    primitiveWidth: PRIMITIVE_U_SIZE,
    primitiveHeight: PRIMITIVE_X_SIZE,
  };
}

export function getEaseInOutLiquifyLookup() {
  if (!easeInOutLookupCache) {
    easeInOutLookupCache = createLiquifyLookupFromKernel(
      solveKernelForEaseInOutProfile(),
    );
  }

  return easeInOutLookupCache;
}
