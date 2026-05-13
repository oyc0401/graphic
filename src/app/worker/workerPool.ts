// 메인스레드 임포트 영역

import type { WebGL2Controller } from "@/core/webgl2/paintController";

const rendererPool: {
  [key: string]: WebGL2Controller;
} = {};

export function getLayerWorker() {
  return rendererPool["layer"];
}

export function setLayerWorker(renderer: WebGL2Controller) {
  rendererPool["layer"] = renderer;
}
