const width = 4000;
const height = 4000;
const size = width * height * 4;

// 1. 배열 생성 및 초기화
const pixels = new Uint8Array(size);
for (let i = 0; i < size; i++) {
  pixels[i] = i % 256; // 예시 초기값 (0~255 순환)
}

(() => {
  // 2. 배열 접근 (읽기만 수행)
  let sum = 0;
  const start = performance.now();

  for (let i = 0; i < size; i++) {
    pixels[i] = 9;
  }

  const end = performance.now();
  console.log(`접근 시간: ${(end - start).toFixed(2)} ms, 합계: ${sum}`);
})();

(() => {
  // 2. 배열 접근 (읽기만 수행)
  let sum = 0;
  const start = performance.now();

  for (let i = 0; i < size; i++) {
    sum += pixels[i];
  }

  const end = performance.now();
  console.log(`접근 시간: ${(end - start).toFixed(2)} ms, 합계: ${sum}`);
})();

(() => {
  // 2. 배열 접근 (읽기만 수행)
  let sum = 0;
  const start = performance.now();

  for (let i = 0; i < size; i++) {
    sum += 1;
  }

  const end = performance.now();
  console.log(`접근 시간: ${(end - start).toFixed(2)} ms, 합계: ${sum}`);
})();

(() => {
  // 2. 배열 접근 (읽기만 수행)
  let sum = 0;
  const start = performance.now();

  for (let i = 0; i < size; i++) {
    pixels[i] += pixels[i];
  }

  const end = performance.now();
  console.log(`접근 시간: ${(end - start).toFixed(2)} ms, 합계: ${sum}`);
})();

(() => {
  // 2. 배열 접근 (읽기만 수행)
  let sum = 0;
  const start = performance.now();

  for (let i = 0; i < size; i++) {
    pixels[i] += pixels[(i + 1) % i];
  }

  const end = performance.now();
  console.log(`접근 시간: ${(end - start).toFixed(2)} ms, 합계: ${sum}`);
})();
