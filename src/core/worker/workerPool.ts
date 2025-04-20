import * as Comlink from "comlink";
import { workerApi } from "./paintController";
import { copyPixelsToClipboard, downloadPixels } from "../../file";
import WorkerModule from "./worker?worker";

type WorkerApi = typeof workerApi;

interface WorkerPool {
  [key: string]: {
    worker: Worker;
    workerApi: Comlink.Remote<WorkerApi>;
  };
}
const workerPool: WorkerPool = {};

function getWorkerObject() {
  if (!workerPool["layer"]) {
    const worker = new WorkerModule();

    // 워커가 postMessage 한 거 수신
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "copy") {
        let { pixels, width, height } = payload;
        let pixelData: Uint8ClampedArray = pixels;
        copyPixelsToClipboard(pixelData, width, height);
      }
      if (type === "download") {
        let { pixels, width, height } = payload;
        let pixelData: Uint8ClampedArray = pixels;
        downloadPixels(pixelData, width, height);
      }
    };
    const api = Comlink.wrap<WorkerApi>(worker);

    workerPool["layer"] = { worker, workerApi: api };
  }
  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().workerApi;
}
