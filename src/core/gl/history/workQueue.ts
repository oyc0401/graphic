const flags = { drawing: false };
export function setDrawingFlag(value) {
  flags.drawing = value;
}

let lowQueue: LowWorkQueue;

export function pushLowQueue(gl, work: Function) {
  if (!lowQueue) {
    lowQueue = new LowWorkQueue(gl);
  }

  lowQueue.push(work);
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

      if (!flags.drawing) {
        const work = this.queue.pop();
        await work();
      }
    }

    this.running = false;
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
