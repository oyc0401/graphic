import * as lz4 from "lz4js";

export class PixelStore<T extends PixelTypedArray = any> {
  private compressed: Uint8Array;
  private readonly _width: number;
  private readonly _height: number;
  private readonly TypedArrayConstructor: new (buffer: ArrayBuffer) => T;

  private constructor(
    compressed: Uint8Array,
    width: number,
    height: number,
    TypedArrayConstructor: new (buffer: ArrayBuffer) => T,
  ) {
    this.compressed = compressed;
    this._width = width;
    this._height = height;
    this.TypedArrayConstructor = TypedArrayConstructor;
  }

  static fromPixelData<T extends PixelTypedArray>(
    pixelData: T,
    width: number,
    height: number,
  ): PixelStore<T> {
    const raw = new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
    const compressed = lz4.compress(raw) as Uint8Array;
    const Constructor = pixelData.constructor as new (buffer: ArrayBuffer) => T;
    return new PixelStore(compressed, width, height, Constructor);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get size(): number {
    return this.compressed.byteLength;
  }

  getPixelData(): T {
    const decompressed = lz4.decompress(this.compressed) as Uint8Array;
    return new this.TypedArrayConstructor(decompressed.buffer as ArrayBuffer);
  }
}

export type PixelTypedArray = Uint8Array | Uint16Array | Float32Array;
