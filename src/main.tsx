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
import { getLayerWorker } from "./core/worker/workerPool";
import { attachPointerEvents } from "./events/pointerEvents";
import { tranferCanvas } from "./ui/canvas";
import { addGestureEvent } from "./events/gestures";
import { addKeyboardEvent } from "./events/keyboardEvent";
import { paintState } from "./paintState";
import { useEffect } from "react";

const root = document.getElementById("appbar-root");
if (root) {
  createRoot(root).render(
    <>
      <AppBar />
      <Runner />
    </>,
  );
} else {
  console.error("appbar-root not found!");
}

function Runner() {
  useEffect(() => {
    console.log("useEffect!");
  }, []);

  return <></>;
}

window.onload = () => {
  console.log("load");
  updateBouncingRect();
  console.log("screenHeight0", position.screenHeight);
  requestAnimationFrame(() => {
    updateBouncingRect();
    console.log("screenHeight1", position.screenHeight);
    requestAnimationFrame(() => {
      updateBouncingRect();
      console.log("screenHeight2", position.screenHeight);
      requestAnimationFrame(() => {
        updateBouncingRect();
        console.log("screenHeight3", position.screenHeight);
        main();
      });
    });
  });
};

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
  setCanvasCSSSize();

  // 캔버스 업로드
  tranferCanvas();

  console.log("Complete App!");

  debugSetting();

  updateBouncingRect();
  console.log("screenHeightF", position.screenHeight);

  requestAnimationFrame(() => {
    updateBouncingRect();
    console.log("screenHeightQ", position.screenHeight);
  });
}

function debugSetting() {
  globalThis.position = position;
  globalThis.paintState = paintState;
  globalThis.selection = selection;

  window.addEventListener("resize", async function () {
    // debounce(async () => {
    // console.log("debounce");
    requestAnimationFrame(() => {
      updateBouncingRect();
      resizeScreen();
      render();
      setCanvasCSSSize();
      setCameraPosition();
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
function setCanvasCSSSize() {
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
