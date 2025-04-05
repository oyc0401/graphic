import * as Comlink from "comlink";
import { workerApi } from "./paintController";
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
    //const worker = new Worker(new URL("./worker.js", import.meta.url), {
    //   type: "module",
    //});

    // 워커가 postMessage 한 거 수신
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "copy") {
        navigator.clipboard.writeText(payload);
        console.log("클립보드에 복사됨:", payload);
      }Comlink
    };
    const api = Comlink.wrap<WorkerApi>(worker);

    workerPool["layer"] = { worker, workerApi: api };
  }
  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().workerApi;
}
