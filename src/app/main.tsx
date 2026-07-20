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
import { reaction } from "mobx";
import {
  addClipboardEvent,
  applyInitialDrawing,
  loadSavedDrawing,
  syncDrawingUrl,
} from "./file/file";
import { documentState } from "./documentState";
import { Dashboard } from "./components/Dashboard";

import { bindView } from "./ui/view";
import { getLayerWorker } from "./worker/workerPool";
import { tranferCanvas } from "./canvas";
import { addKeyboardEvent } from "./events/keyboardEvent";
import { paintState, SessionId } from "./paintState";
import { syncCoreState } from "./history";
import { BottomNav } from "./components/BottomNav";
import { runPointerTests } from "@/test/pointerTestUtils";
import { loadInitialImageFromQuery } from "./file/initialImage";
import { getInitialRoute } from "./file/initialRouteSession";
import { installGestureAdapter } from "./events/gestureAdapter";
import { cssDeltaToScene } from "./utils/cameraMath";

const initialRoute = getInitialRoute();
const initialRouteSession = initialRoute.session;
if (initialRouteSession !== null) {
  paintState.setSessionId(initialRouteSession);
}

if (initialRoute.page === "dashboard") {
  mountDashboard();
} else {
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
}

// 대시보드는 페인트 앱 HTML을 재사용한다(vercel.json rewrite).
// 캔버스 관련 정적 DOM을 숨기고 React 루트만 마운트한다.
function mountDashboard() {
  const container = document.getElementById("container");
  if (container) container.style.display = "none";
  document.body.style.overflow = "auto";

  const dashboardRoot = document.createElement("div");
  dashboardRoot.id = "dashboard-root";
  document.body.appendChild(dashboardRoot);
  createRoot(dashboardRoot).render(<Dashboard />);
}

export function runApp() {
  if (initialRoute.page === "dashboard") return;

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

  // 저장된 그림은 부트 전에 읽어 초기 이미지 루트로 첫 렌더에 태운다 (플리커 방지)
  const savedDrawing = initialRoute.drawingId
    ? await loadSavedDrawing(initialRoute.drawingId)
    : null;
  const initialImage =
    savedDrawing?.bitmap ?? (await loadInitialImageFromQuery());

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

  applyInitialDrawing(savedDrawing, initialRoute.drawingId);

  // 세션 진입/종료(유동화·모자이크)를 ?tool= 쿼리로 주소창에 반영한다
  reaction(
    () => paintState.getSessionId(),
    () => syncDrawingUrl(),
  );

  window.addEventListener("beforeunload", (e) => {
    if (!documentState.getDirty()) return;
    e.preventDefault();
    e.returnValue = ""; // 구형 Chrome 호환
  });

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

  globalThis.layerWorker = getLayerWorker();

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
