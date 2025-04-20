export function decodePremultAndFlip(
  flippedPixel: Uint8Array,
  width,
  height,
): Uint8ClampedArray {
  // 최종 픽셀 (논프멀, 위에서 아래로 플립됨)
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    const srcStart = row * width * 4;
    const dstStart = (height - row - 1) * width * 4;

    for (let i = 0; i < width; i++) {
      const srcIndex = srcStart + i * 4;
      const dstIndex = dstStart + i * 4;

      const r = flippedPixel[srcIndex + 0];
      const g = flippedPixel[srcIndex + 1];
      const b = flippedPixel[srcIndex + 2];
      const a = flippedPixel[srcIndex + 3];

      if (a > 0) {
        const factor = 255 / a;
        pixels[dstIndex + 0] = Math.min(r * factor, 255);
        pixels[dstIndex + 1] = Math.min(g * factor, 255);
        pixels[dstIndex + 2] = Math.min(b * factor, 255);
      } else {
        // 알파 0이면 RGB도 0
        pixels[dstIndex + 0] = 0;
        pixels[dstIndex + 1] = 0;
        pixels[dstIndex + 2] = 0;
      }

      pixels[dstIndex + 3] = a;
    }
  }

  return pixels;
}


const decodePremultAndFlip2 = (() => {
  return function (
    flippedPixel: Uint8Array,
    width: number,
    height: number,
  ): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let row = 0; row < height; row++) {
      const srcStart = row * width * 4;
      const dstStart = (height - row - 1) * width * 4;

      for (let i = 0; i < width; i++) {
        const srcIndex = srcStart + i * 4;
        const dstIndex = dstStart + i * 4;

        const a = flippedPixel[srcIndex + 3];
        const factor = a > 0 ? 255 / a : 0;

        pixels[dstIndex + 0] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 0] * factor, 255) : 0;
        pixels[dstIndex + 1] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 1] * factor, 255) : 0;
        pixels[dstIndex + 2] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 2] * factor, 255) : 0;
        pixels[dstIndex + 3] = a;
      }
    }

    return pixels;
  };
})();
