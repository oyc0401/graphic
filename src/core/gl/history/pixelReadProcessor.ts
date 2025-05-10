import { PixelReader } from "./PixelReader";

let drawing = false;
export function setDrawingFlag(value) {
  drawing = value;
}

let readPixelQueue: PixelReadProcessor;

export function pushReadPixelQueue(gl, pixelReader: PixelReader) {
  if (!readPixelQueue) {
    readPixelQueue = new PixelReadProcessor(gl);
  }

  readPixelQueue.push(pixelReader);
}

export class PixelReadProcessor {
  gl: WebGL2RenderingContext;
  readPixelStack: PixelReader[] = []; // 최신 변경사항을 접근할 일이 많으니 LIFO로

  running = false;
  constructor(gl) {
    this.gl = gl;
  }

  push(pixelReader: PixelReader) {
    setDrawingFlag(false);
    this.readPixelStack.push(pixelReader);
    this.excute();
  }

  async excute() {
    if (this.running) return;
    this.running = true;

    while (this.readPixelStack.length > 0) {
      if (!drawing) {
        const pixelReader = this.readPixelStack.pop();

        while (!pixelReader.isEmpty()) {
          await waitForSync(this.gl);
          if (pixelReader.isEmpty()) break;

          const fn = pixelReader.front();
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
