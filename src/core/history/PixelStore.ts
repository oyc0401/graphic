export class PixelStore<T extends PixelTypedArray = any> {
  pixelData!: T;
  complete = false;

  static fromPixelData<T extends PixelTypedArray = any>(
    pixelData: T,
    width: number,
    height: number,
  ): PixelStore<T> {
    const instance = Object.create(PixelStore.prototype);
    instance.pixelData = pixelData;
    instance.complete = true;
    instance.width = width;
    instance.height = height;
    return instance;
  }

  getPixelData(isQueue = false): T {
    return this.pixelData;
  }
}

export type PixelTypedArray = Uint8Array | Uint16Array | Float32Array;
