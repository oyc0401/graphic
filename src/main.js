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

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  //let p = to_screen_coord(x, y);
  console.log(x, y);
  // let px = p.x + position.width / 2;
  //let py = p.y + position.height / 2;
  // let px = p.x + position.width;
  // let py = p.y + position.height;
  return { x, y: y - 133 };
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px =
    (x - paintState.bouncingRect.width / 2 - paintState.bouncingRect.x) /
      position.scale +
    position.x;
  let py =
    (y - paintState.bouncingRect.height / 2 - paintState.bouncingRect.y) /
      position.scale +
    position.y;
  return { x: px, y: py };
}

async function main() {
  paintState.initiaize();
  position.initiaize();

  position.width = 500;
  position.height = 500;

  await initiaize();

  positionInit();
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

  let toolId = "brush";

  let pointerActive = false;

  document.querySelector("#container").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (paintState.action != "BRUSH") return;
    //to_screen_coord(e.clientX, e.clientY);
    console.log("brushStart!");

    pointerActive = true;
    let point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();

    // worker.setStrokeColor( 10, 10, 0);
    // worker.setStrokeSize( paintState.brushSize);
    // worker.setAlpha( paintState.brushAlpha);

    worker.drawStart(point);
    worker.drawTo(point);
  });

  window.addEventListener("pointermove", (e) => {
    e.preventDefault();
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;
    if (!pointerActive) return;

    let point = to_canvas_coord(e.clientX, e.clientY);

    const worker = getLayerWorker();

    worker.drawTo( point);
  });

  window.addEventListener("pointerup", (e) => {
    e.preventDefault();
    if (paintState.action != "BRUSH") return;
    if (!pointerActive) return;

    let point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();

    worker.drawTo(point);

    pointerActive = false;
    // endDrawing();

    // applyKeyAction();
    // setCursor();
  });
}

function positionInit() {
  document.querySelector("#container").addEventListener(
    "pointerdown",
    (_) => {
      paintState.pointerdown = true;
      setCursor();
      // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
    },
    true,
  );

  window.addEventListener(
    "pointerup",
    (_) => {
      paintState.pointerdown = false;
      setCursor();
      // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
    },
    true,
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType == "mouse") {
        // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
        paintState.pointerX = event.clientX;
        paintState.pointerY = event.clientY;
        setCursor();
      }
    },
    true,
  );

  window.addEventListener("contextmenu", (event) => event.preventDefault());
}

function setCursor() {}
