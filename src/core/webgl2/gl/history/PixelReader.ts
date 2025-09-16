import { lowQueue, pushManyLowQueue } from "./workQueue";
import { PixelStorage, PixelTypedArray } from "./PixelStore";

const CHUNK_BYTES = 2_100_000_000; // 한 번에 읽을 최대 바이트 수

export class PixelReader<T extends PixelTypedArray = Uint8Array>
  implements PixelStorage<T>
{
  pixelData: T;
  complete = false;

  static fbo: WebGLFramebuffer | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private width: number,
    private height: number,
    private texture: WebGLTexture,
    private format: number, // gl.RGBA …
    private type: number // gl.UNSIGNED_BYTE …
  ) {
    const info = getPixelFormatInfo(gl, format, type);
    this.pixelData = new (info.TypedArray as any)(
      width * height * info.components
    ) as T;

    /* FBO 초기화(싱글턴) */
    if (!PixelReader.fbo) {
      PixelReader.fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, PixelReader.fbo);
    }

    /* chunk 단위 작업 생성 → 공용 lowQueue 로 등록 */
    let jobs = this.makeJobs(info);

    pushManyLowQueue(gl, jobs);
  }

  static fromPixelData<T extends PixelTypedArray = Uint8Array>(
    pixelData: T,
    width: number,
    height: number
  ): PixelReader<T> {
    const instance = Object.create(PixelReader.prototype);
    instance.pixelData = pixelData;
    instance.complete = true;
    instance.width = width;
    instance.height = height;
    return instance;
  }

  async getPixelData(isQueue = false): Promise<T> {
    if (isQueue && !this.complete) {
      console.error("큐의 순서가 뒤집힘!");
    }
    if (!this.complete) {
      await lowQueue.finish();
    }
    return this.pixelData;
  }

  private makeJobs(info: PixelFormatInfo) {
    const { gl, width, height, texture } = this;
    const { components, bytesPerComponent, bytesPerPixel, TypedArray } = info;
    const rowsPerChunk = Math.floor(CHUNK_BYTES / (width * bytesPerPixel));

    let workQueue: Function[] = [];

    for (let row = 0; row < height; row += rowsPerChunk) {
      workQueue.push(async () => {
        const rows = Math.min(rowsPerChunk, height - row);
        const sub = new TypedArray(
          this.pixelData.buffer as ArrayBuffer,
          row * width * components * bytesPerComponent,
          rows * width * components
        );

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, PixelReader.fbo);
        gl.framebufferTexture2D(
          gl.READ_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0
        );
        gl.readPixels(0, row, width, rows, this.format, this.type, sub);

        console.log("[PixelReader]", "read");
      });
    }

    /* 마지막 cleanup + 완료 플래그 */
    workQueue.push(() => {
      gl.deleteTexture(texture);
      this.complete = true;

      console.log("[PixelReader]", "finish");
    });

    return workQueue;
  }
}

/* pixel-format helper  (변경 없음, 타입 추가)  */
type PixelFormatInfo = {
  components: number;
  bytesPerComponent: number;
  bytesPerPixel: number;
  TypedArray: typeof Uint8Array | typeof Uint16Array | typeof Float32Array;
};

// WebGL pixel format/type 헬퍼
function getPixelFormatInfo(
  gl: WebGL2RenderingContext,
  format: number,
  type: number
) {
  let components = 4; // default: RGBA
  switch (format) {
    case gl.RED:
      components = 1;
      break;
    case gl.RG:
      components = 2;
      break;
    case gl.RGB:
      components = 3;
      break;
    case gl.RGBA:
      components = 4;
      break;
    default:
      console.warn("Unknown format, defaulting components to 4 (RGBA)");
  }

  let bytesPerComponent = 1;
  let TypedArray: typeof Uint8Array | typeof Uint16Array | typeof Float32Array =
    Uint8Array;

  switch (type) {
    case gl.UNSIGNED_BYTE:
      bytesPerComponent = 1;
      TypedArray = Uint8Array;
      break;
    case gl.HALF_FLOAT:
      bytesPerComponent = 2;
      TypedArray = Uint16Array;
      break;
    case gl.FLOAT:
      bytesPerComponent = 4;
      TypedArray = Float32Array;
      break;
    default:
      console.warn("Unknown type, defaulting to UNSIGNED_BYTE");
  }

  const bytesPerPixel = components * bytesPerComponent;

  return {
    components,
    bytesPerComponent,
    bytesPerPixel,
    TypedArray,
  };
}
