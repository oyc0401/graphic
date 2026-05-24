import { createRoot } from "react-dom/client";
import AppBar from "./components/AppBar";

import {
  getPixelRatio,
  position,
  render,
  resizeScreen,
  setCameraPosition,
  setDefaultPosition,
  updateBouncingRect,
} from "./position";
import { els, getElements } from "./ui/elements";
import { addClickEvent } from "./ui/clickEvent";
import { applySelection, selection } from "./selection";
import { addClipboardEvent } from "./file";

import { bindView } from "./ui/view";
import { getLayerWorker } from "./worker/workerPool";
import { attachPointerEvents } from "./events/pointerEvents";
import { tranferCanvas } from "./canvas";
import { addGestureEvent } from "./events/gestures";
import { addKeyboardEvent } from "./events/keyboardEvent";
import { paintState } from "./paintState";
import { BottomNav } from "./components/BottomNav";
import { runPointerTests } from "@/test/pointerTestUtils";
import { loadInitialImageFromQuery } from "./initialImage";

const root = document.getElementById("appbar-root");
if (root) {
  createRoot(root).render(<AppBar />);
} else {
  console.error("appbar-root not found!");
}

const navroot = document.getElementById("nav-root");
if (navroot) {
  createRoot(navroot).render(<BottomNav />);
} else {
  console.error("nav-root not found!");
}

export function runApp() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      main();
    });
  });
}

async function main() {
  console.log("Start App!");

  getElements();

  // 초기 캔버스 위치 계산
  setDefaultPosition();

  // 뷰 바인딩
  bindView();

  addGestureEvent();

  // 이벤트 추가
  attachPointerEvents(els.container);

  addClickEvent();
  addKeyboardEvent();

  addClipboardEvent();
  // dpr이 1이 아니면, 캔버스 확대
  changeCanvasTransform();

  // 캔버스 업로드
  await tranferCanvas();
  await loadInitialImageFromQuery();

  console.log("Complete App!");

  debugSetting();

  setTimeout(() => {
    // runPointerTests();
  }, 200);

  // requestAnimationFrame(() => {
  //   updateBouncingRect();
  //   console.log("screenHeightQ", position.screenHeight);
  // });
}

function debugSetting() {
  globalThis.position = position;
  globalThis.paintState = paintState;
  globalThis.selection = selection;

  window.addEventListener("resize", async function () {
    // debounce(async () => {
    requestAnimationFrame(() => {
      // 플리커링 일어나긴 하는데 걍 두고 나중에 고칩시다
      let lastY = position.bouncingRect.y;
      updateBouncingRect();
      // if (window.innerWidth < 800) {
      //   position.bouncingRect.y = 44;
      //   position.bouncingRect.height = window.innerHeight - 44;
      // } else {
      //   position.bouncingRect.y = 133;
      //   position.bouncingRect.height = window.innerHeight - 133;
      // }
      // position.bouncingRect.width = window.innerWidth;

      let diffY =
        ((lastY - position.bouncingRect.y) / position.scale) * getPixelRatio();

      position.setY(position.y + diffY);

      resizeScreen();

      changeCanvasTransform();
      setCameraPosition();
      render();
      console.log("screenHeightR", position.screenHeight);
    });
    //}, 100);
  });

  globalThis.changeLayer = function (layerId = 1) {
    let worker = getLayerWorker();
    // 레이어 바꾸기 전에 무조건 툴, 선택창 종료하기!
    applySelection();
    worker.setLayerId(layerId);
  };
}

function changeCanvasTransform() {
  let dpr = getPixelRatio();
  els.canvas.style.transform = `scale(${1 / dpr})`;
}

let timer;
function debounce(func, delay) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    func();
  }, delay);
}
