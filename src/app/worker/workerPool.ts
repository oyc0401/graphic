// 메인스레드 임포트 영역

import { PaintApplication } from "@/core/PaintApplication";

const workerPool: {
  [key: string]: PaintApplication;
} = {};

function getWorkerObject() {
  if (!workerPool["layer"]) {
    workerPool["layer"] = new PaintApplication();
  }

  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().service;
}

export function getApplication() {
  return getWorkerObject();
}
