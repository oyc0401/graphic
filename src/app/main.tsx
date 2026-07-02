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
import { applyShape, shape } from "./shape";
import { addClipboardEvent } from "./file/file";

import { bindView } from "./ui/view";
import { getLayerWorker } from "./worker/workerPool";
import { tranferCanvas } from "./canvas";
import { addKeyboardEvent } from "./events/keyboardEvent";
import { paintState, SessionId } from "./paintState";
import { syncCoreState } from "./history";
import { BottomNav } from "./components/BottomNav";
import { runPointerTests } from "@/test/pointerTestUtils";
import { loadInitialImageFromQuery } from "./file/initialImage";
import { getInitialRouteSession } from "./file/initialRouteSession";
import { installGestureAdapter } from "./events/gestureAdapter";
import { cssDeltaToScene } from "./utils/cameraMath";

const initialRouteSession = getInitialRouteSession();
if (initialRouteSession !== null) {
  paintState.setSessionId(initialRouteSession);
}

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

  const initialImage = await loadInitialImageFromQuery();

  // 캔버스 업로드
  await tranferCanvas(initialImage);

  // dpr이 1이 아니면, 캔버스 확대
  changeCanvasTransform();

  // 뷰 바인딩
  bindView();

  installGestureAdapter(els.container);

  addClickEvent();
  addKeyboardEvent();

  addClipboardEvent();

  openInitialRouteSessionInCore(initialRouteSession);

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
  globalThis.shape = shape;

  window.addEventListener("resize", async function () {
    // debounce(async () => {
    requestAnimationFrame(async () => {
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

      let diffY = cssDeltaToScene(
        lastY - position.bouncingRect.y,
        position.scale,
        getPixelRatio(),
      );

      position.setY(position.y + diffY);

      await resizeScreen();

      changeCanvasTransform();
      await setCameraPosition();
      render();
      console.log("screenHeightR", position.screenHeight);
    });
    //}, 100);
  });

  globalThis.changeLayer = function (layerId = 1) {
    let worker = getLayerWorker();
    // 레이어 바꾸기 전에 무조건 툴, 선택창, 도형 종료하기!
    applySelection();
    applyShape();
    worker.setLayerId(layerId);
  };
}

function openInitialRouteSessionInCore(sessionId: SessionId | null) {
  if (sessionId === SessionId.Liquify) {
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(paintState.getLiquifyToolId());
    syncCoreState();
  } else if (sessionId === SessionId.Mosaic) {
    getLayerWorker().openSession("mosaic");
    getLayerWorker().setMosaicTool(paintState.getMosaicToolId());
    getLayerWorker().setMosaicStrength(paintState.getBrushAlpha());
    syncCoreState();
  }
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
