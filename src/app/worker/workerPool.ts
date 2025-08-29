// 메인스레드 임포트 영역

import { DrawingController } from "@/core/DrawingController";

const workerPool: {
  [key: string]: DrawingController;
} = {};

function getWorkerObject() {
  if (!workerPool["layer"]) {
    workerPool["layer"] = new DrawingController();
  }

  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject();
}
