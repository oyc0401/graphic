import { getManager } from "../utils/cachedManager";
import { Rect } from "../utils/dirtyRect";

const d = {};
export function getBitmapManager() {
  const manager = getManager(d, "bitmap", () => new BitmapManager());
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

  copyDirtRect(rect: Rect): Uint8Array {
    const { x, y, width, height } = rect;

    const output = new Uint8Array(width * height * 4);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const srcIndex = ((y + row) * this.width + (x + col)) * 4;
        const dstIndex = (row * width + col) * 4;

        output[dstIndex] = this.bitmap[srcIndex]; // R
        output[dstIndex + 1] = this.bitmap[srcIndex + 1]; // G
        output[dstIndex + 2] = this.bitmap[srcIndex + 2]; // B
        output[dstIndex + 3] = this.bitmap[srcIndex + 3]; // A
      }
    }
    //console.log(output);
    return output;
  }

  applyDirtyRect(image: Uint8Array, rect: Rect): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const dstIndex = ((y + row) * this.width + (x + col)) * 4;
        const srcIndex = (row * width + col) * 4;

        this.bitmap[dstIndex] = image[srcIndex]; // R
        this.bitmap[dstIndex + 1] = image[srcIndex + 1]; // G
        this.bitmap[dstIndex + 2] = image[srcIndex + 2]; // B
        this.bitmap[dstIndex + 3] = image[srcIndex + 3]; // A
      }
    }
  }
}
