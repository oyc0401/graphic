/** main.ts */
import React from "react";
import { createRoot } from "react-dom/client";
import AppBar from "./components/AppBar";

import {
    getPixelRatio,
    position,
    render,
    resizeScreen,
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

window.onload = main;

const root = document.getElementById("appbar-root");
if (root) {
    createRoot(root).render(<AppBar />);
} else {
    console.error("appbar-root not found!");
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
    setCanvasCSSSize();

    // 캔버스 업로드
    await tranferCanvas();

    console.log("Complete App!");

    debugSetting();
}

function debugSetting() {
    globalThis.position = position;
    globalThis.paintState = paintState;
    globalThis.selection = selection;

    window.addEventListener("resize", async function () {
        debounce(async () => {
            console.log("debounce");
            updateBouncingRect();
            resizeScreen(); // worker에 있는 webgl에 드로우콜 날림
            render();
            setCanvasCSSSize();
        }, 100);
    });

    globalThis.changeLayer = function (layerId = 1) {
        let worker = getLayerWorker();
        // 레이어 바꾸기 전에 무조건 툴, 선택창 종료하기!
        applySelection();
        worker.setLayerId(layerId);
    };

    els.container.addEventListener(
        "touchstart",
        function (event) {
            // text Loupe disable
            event.preventDefault();
        },
        false,
    );
}
function setCanvasCSSSize() {
    let dpr = getPixelRatio();
    if (dpr != 1) {
        els.canvas.style.width = `${position.bouncingRect.width}px`;
        els.canvas.style.height = `${position.bouncingRect.height}px`;
    }
}

let timer;
function debounce(func, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
        func();
    }, delay);
}
