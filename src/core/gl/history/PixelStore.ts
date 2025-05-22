import { lowQueue, pushLowQueue } from "./workQueue";

export class PixelStore<T extends PixelTypedArray = Uint8Array>
  implements PixelStorage<T>
{
  pixelData!: T; // 뒤에서 채워지므로 definite-assignment (!) 사용
  complete = false;

  constructor(
    gl: WebGL2RenderingContext,
    job: () => T // ⬅️ 반환 타입도 동일 제네릭
  ) {
    pushLowQueue(gl, async () => {
      this.pixelData = job();
      this.complete = true;
    });
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
}

export type PixelTypedArray = Uint8Array | Uint16Array | Float32Array;

/** ② 픽셀 버퍼를 들고 다니는 최소 계약 */
export interface PixelStorage<T extends PixelTypedArray = Uint8Array> {
  readonly pixelData: T;
  readonly complete: boolean;
  getPixelData(isQueue?: boolean): Promise<T>;
}
