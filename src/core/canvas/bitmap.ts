import { getManager } from "../utils/cachedManager";
import { RectNew } from "../utils/rect";

export function getBitmapManager() {
  const manager = getManager(1, "bitmap", () => new BitmapManager());
  return manager;
}

class BitmapManager {
  bitmap: Uint8ClampedArray;
  width: number;
  height: number;

  initState(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bitmap = new Uint8ClampedArray(width * height * 4);
  }

  copyDirtyRect(rect: RectNew): Uint8Array {
    const { x, y, width, height } = rect;
    const output = new Uint8Array(width * height * 4);

    for (let row = 0; row < height; row++) {
      const srcOffset = ((y + row) * this.width + x) * 4;
      const dstOffset = row * width * 4;

      output.set(
        this.bitmap.subarray(srcOffset, srcOffset + width * 4),
        dstOffset
      );
    }

    return output;
  }

  applyDirtyRect(image: Uint8Array, rect: RectNew): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      const dstOffset = ((y + row) * this.width + x) * 4;
      const srcOffset = row * width * 4;

      // 성능 최적화를 위해 블록 단위로 복사
      this.bitmap.set(
        image.subarray(srcOffset, srcOffset + width * 4),
        dstOffset
      );
    }
  }

  applyResizeDirtyRect(image: Uint8Array, width: number, height: number): void {
    console.log("applyResizeDirtyRect", width, height);

    // 깊은 복사: set() 사용
    this.bitmap = new Uint8ClampedArray(width * height * 4);
    this.bitmap.set(image); // 빠르고 정확하게 깊은 복사

    this.width = width;
    this.height = height;
  }
}
