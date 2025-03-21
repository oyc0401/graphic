import * as Comlink from "comlink";
import { getLayerWorker } from "./worker/workerPool";

if (window) {
  window.onload = main;
}
let paintState = {
  action: "BRUSH",
  brushSize: 5,
  brushAlpha: 0.3,
  container: null,
  //layer_area: document.querySelector("#layer-area"),
  bouncingRect: null,
  updateBouncingRect() {
    this.bouncingRect = this.container.getBoundingClientRect();
  },
  pointerdown: false,
  pointerX: 0,
  pointerY: 0,
  initiaize() {
    paintState.container = document.querySelector("#container");
  },
};
let position = {
  x: 0,
  y: 0,
  width: 500,
  height: 500,
  scale: 1,
  resizeScreen() {},
  initiaize() {
    paintState.updateBouncingRect();
  },
};

async function main() {
  paintState.initiaize();
  position.initiaize();

  position.width = 500;
  position.height = 500;

  await initiaize();
}

async function initiaize() {
  let canvas = document.querySelector("#canvas");

  const offscreen = canvas.transferControlToOffscreen();

  let screenWidth = paintState.bouncingRect.width;
  let screenHeight = paintState.bouncingRect.height;

  const worker = getLayerWorker();

  await worker.initState(
    Comlink.transfer(offscreen, [offscreen]),
    position.width,
    position.height,
    screenWidth,
    screenHeight,
  );
}
