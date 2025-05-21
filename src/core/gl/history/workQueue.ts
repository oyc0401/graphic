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
      await waitForSync(this.gl, 32);

      if (this.queue.length > 0 && !flags.drawing) {
        const work = this.queue.pop();
        await work();
      }
    }

    this.running = false;
  }

  front() {
    return this.queue[0];
  }

  pop() {
    this.queue.shift();
  }

  pushPixelReader(pixleReader: PixelReader) {
    for (let job of pixleReader.getJobs()) {
      this.push(job);
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
