import { PixelReader } from "./PixelReader";

const flags = { drawing: false };
export function setDrawingFlag(value) {
  flags.drawing = value;
}

export let lowQueue: LowWorkQueue;

export function pushLowQueue(gl, work: Function) {
  if (!lowQueue) {
    lowQueue = new LowWorkQueue(gl);
  }

  lowQueue.push(work);
}

export function pushReadPixelQueue(gl, pixelReader: PixelReader) {
  if (!lowQueue) {
    lowQueue = new LowWorkQueue(gl);
  }

  lowQueue.pushPixelReader(pixelReader);
}

class LowWorkQueue {
  gl: WebGL2RenderingContext;

  queue: Function[] = [];

  running = false;
  constructor(gl) {
    this.gl = gl;
  }

  push(work: Function) {
    setDrawingFlag(false);
    this.queue.push(work);
    this.excute();
  }

  async excute() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      if (this.stopRequested) break;
      await waitForSync(this.gl, 32);
      if (this.stopRequested) break;
      if (this.queue.length > 0 && !flags.drawing) {
        const work = this.front();
        this.pop();
        await work();
      }
    }

    this.running = false;

    // ✅ stop 콜백 실행
    if (this.stopRequested && this.onStop) {
      this.onStop();
      this.onStop = null;
      this.stopRequested = false;
    }
  }

  front() {
    return this.queue[0];
  }

  pop() {
    this.queue.shift();
  }

  pushPixelReader(pixleReader: PixelReader) {
    setDrawingFlag(false);
    let jobs = pixleReader.getJobs();
    for (let job of jobs) {
      this.queue.push(job);
    }
    this.excute();
  }
  // ✅ 추가된 상태값
  stopRequested = false;
  onStop: (() => void) | null = null;

  stop(fn: () => void) {
    this.stopRequested = true;
    this.onStop = fn;

    // 실행 중이 아닐 경우 즉시 콜백
    if (!this.running) {
      fn();
      this.onStop = null;
      this.stopRequested = false;
    }
  }
}

async function waitForSync(gl, time) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

  while (true) {
    await new Promise((r) => setTimeout(r, time));

    const status = gl.clientWaitSync(sync, 0, 0); // timeout 무조건 0
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      break;
    }
  }
  gl.deleteSync(sync);
}
