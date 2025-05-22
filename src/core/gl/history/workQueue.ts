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

  pushPixelReader(pixleReader: PixelReader) {
    setDrawingFlag(false);
    let jobs = pixleReader.getJobs();
    for (let job of jobs) {
      this.queue.push(job);
    }
    this.excute();
  }

  private forceFlush = false;
  /** excute() 완료 통지용 프라미스 */
  private donePromise: Promise<void> | null = null;
  private doneResolve: (() => void) | null = null;

  private async excute() {
    if (this.running) return; // 재진입 차단
    this.running = true;

    /* 🌟 새 완료 프라미스 생성 */
    this.donePromise = new Promise<void>((res) => (this.doneResolve = res));

    try {
      while (this.queue.length > 0) {
        if (!this.forceFlush) {
          await waitForSync(this.gl, 32);
        }

        if (this.queue.length > 0 && !flags.drawing) {
          const work = this.queue.shift()!;
          await work();
        }
      }
    } finally {
      this.running = false;

      /* 🛎️ finish() 대기 해제 */
      this.doneResolve?.();
      this.donePromise = null;
      this.doneResolve = null;
    }
  }

  front() {
    return this.queue[0];
  }

  pop() {
    this.queue.shift();
  }

  empty() {
    return this.queue.length == 0;
  }

  /**  ✨ 모든 작업을 지연 없이 순차적으로 소모 & 완료될 때까지 대기 */
  async finish(): Promise<void> {
    this.forceFlush = true; // flush 모드 진입
    this.excute(); // excute()가 돌고 있지 않으면 즉시 시작

    if (this.donePromise) {
      await this.donePromise; // busy-wait 없이 정확히 종료 시점까지 대기
    }

    this.forceFlush = false; // flush 모드 해제 (이후 push 는 다시 waitForSync 사용)
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
