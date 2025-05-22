import { getBitmapManager } from "../layer";
import { Rect } from "../utils/dirtyRect";
import { lowQueue, pushLowQueue } from "./pixelReadProcessor";

export class PixelStore implements PixelStorage {
  pixelData;

  rect: Rect;
  complete: boolean;
  constructor(gl, rect) {
    this.rect = rect;
    this.complete = false;

    pushLowQueue(gl, async () => {
      this.excute();
    });
  }

  excute() {
    const bitmapManager = getBitmapManager();
    this.pixelData = bitmapManager.copyDirtRect(this.rect);
    this.complete = true;
  }

  async getPixelData(isQueue = false) {
    // 이때 큐에서 현재 실행되고있는게 다 실행 완료 되기까지 기다리기
    if (isQueue && !this.complete) {
      console.error("큐의 순서가 뒤집힘!");
    }
    if (!this.complete) {
      await lowQueue.finish();
    }

    return this.pixelData;
  }
}

export interface PixelStorage {
  getPixelData: (bool?) => Promise<any>;
}
