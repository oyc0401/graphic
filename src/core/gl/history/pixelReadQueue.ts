import { PixelReader } from "./PixelReader";

let drawing = false;
export function setQueueDrawingFlag(value) {
  drawing = value;
}

export class PixelReadQueueManager {
  gl: WebGL2RenderingContext;
  readPixelQueue: PixelReader[] = [];

  running = false;
  constructor(gl) {
    this.gl = gl;
  }

  push(pixelReader: PixelReader) {
    this.readPixelQueue.push(pixelReader);
  }

  async excute() {
    if (this.running) return;
    this.running = true;
    while (this.readPixelQueue.length > 0) {
      // 읽고 나서 다음 작업으로 넘어가기 전에 잠시 대기

      if (!drawing) {
        const pixelReader = this.readPixelQueue.shift();
        while (!pixelReader.isEmpty()) {
          await waitForSync(this.gl);
          if (pixelReader.isEmpty()) return;

          let fn = pixelReader.front();
          fn();
          pixelReader.pop();
        }
      } else {
        await new Promise((r) => setTimeout(r, 32));
      }
    }
    this.running = false;
  }
}

async function waitForSync(gl) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();

  while (true) {
    const status = gl.clientWaitSync(sync, 0, 0); // timeout 무조건 0
    // console.log("while:", status);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      break;
    }
    // GPU가 아직 안 끝났으면, CPU는 양보
    await new Promise((r) => setTimeout(r, 0));
  }
  gl.deleteSync(sync);
}
