// 메인스레드 임포트 영역
import * as Comlink from "comlink";
import { workerApi } from "../../core/worker/paintController";
import WorkerModule from "../../core/worker/worker?worker";
import { mainApi } from "./mainController";
import { Callink } from "callink";

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

    // 워커 수신
    Callink.provide(worker, mainApi);

    // worker 사용
    const api = Comlink.wrap<WorkerApi>(worker);

    // main 쓰레드 사용
    // const api = workerApi;

    workerPool["layer"] = { worker, workerApi: api };
  }
  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().workerApi;
}
