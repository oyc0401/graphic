/** draw.ts */ 
import { paintState } from "./main";
import { els } from "./elements";
import { getPixelRatio, position } from "./position";
import { to_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { applySelection, selectionCancel } from "./selection";

export const toolManager = {
    setBrushTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("brush");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);

        console.log("brush");
    },
    setEraserTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("eraser");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);
    },
    setLiquifyTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("liquify");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);
    },
    setSelectTool() {
        applySelection();
        paintState.setToolId("select");

        const worker = getLayerWorker();
        worker.setTool(paintState.brushId);
    },
};

let pointerActive = false;

export async function tranferCanvas() {
    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

    let dpr = getPixelRatio();
    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
        position.bouncingRect.width * dpr,
        position.bouncingRect.height * dpr,
        dpr,
        position.width,
        position.height,
        position.x * dpr,
        position.y * dpr,
        position.scale,
    );

    // // 캔버스 렌더링
    // setCameraPosition();
    // resizeScreen();
    // resizeLayer();
    // render();
}

export function addDrawEvent() {
    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };

    (function () {
        els.container.addEventListener(
            "pointerdown",
            function (e: PointerEvent) {
                e.preventDefault();
                if (!paintState.pointerdown) return;
                if (paintState.action != "BRUSH") return;
                if (paintState.toolId != "brush") return;
                //  console.log("brushStart!");

                pointerActive = true;
                let point = to_canvas_coord(e.clientX, e.clientY);
                const worker = getLayerWorker();

                let brushSize = paintState.getBrushSize();
                let brushAlpha = paintState.getBrushAlpha();
                worker.setStrokeSize(brushSize);
                worker.setAlpha(brushAlpha);
                worker.setStrokeColor(
                    paintState.color.r,
                    paintState.color.g,
                    paintState.color.b,
                );
                if (paintState.brushId == "brush") {
                    worker.start(point);
                } else if (paintState.brushId == "eraser") {
                    worker.start(point);
                } else if (paintState.brushId == "liquify") {
                    worker.start(point);
                    start = { x: e.clientX, y: e.clientY };
                    end = { x: e.clientX, y: e.clientY };
                }
            },
        );

        window.addEventListener("pointermove", (e) => {
            e.preventDefault();
            // console.log(to_canvas_coord(e.clientX, e.clientY))
            if (!paintState.pointerdown) return;
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "brush") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);

            const worker = getLayerWorker();
            let brushSize = paintState.getBrushSize();

            if (paintState.brushId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "liquify") {
                end = point;

                let length = Math.hypot(end.x - start.x, end.y - start.y);
                if (length > brushSize / 25) {
                    worker.strokeTo(point);
                    start = end;
                }
            }

            paintState.setDrawdownAndMoved(true);
            paintState.setCursorPosition(e.clientX, e.clientY);
        });

        window.addEventListener("pointerup", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "brush") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);
            const worker = getLayerWorker();
            if (paintState.brushId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "liquify") {
            }

            endDrawing();
            paintState.changed = true;

            pointerActive = false;
        });
    })();
}

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
    console.log("cancel!");
    pointerActive = false;

    const worker = getLayerWorker();

    if (paintState.toolId == "selection") {
        selectionCancel();
        return;
    }
    if (paintState.toolId == "brush") {
        worker.cancel();
    }
}

/**
 * 그리기 종료
 */
export function endDrawing() {
    console.log("end!");
    pointerActive = false;

    const worker = getLayerWorker();
    worker.end();
}


/** elements.ts */ 
import BrushSvg from "./assets/brush.svg?raw";
import EraserSvg from "./assets/eraser.svg?raw";
import SelectionSvg from "./assets/select_rectangle.svg?raw";
import LiquifySvg from "./assets/liquify.svg?raw";

import MenuSvg from "./assets/menu.svg?raw";
import UndoSvg from "./assets/undo.svg?raw";
import RedoSvg from "./assets/redo_disabled.svg?raw";

import CursorSvg from "./assets/cursor.svg?raw";

function $id<T extends HTMLElement = HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (element) {
    return element as T;
  }
  throw new Error(`No element found with id "${elementId}"`);
}

export let els = {
  canvas: $id<HTMLCanvasElement>("canvas")!,
  container: $id("container"),
  brushCursor: $id("brush-cursor"),

  selectSelectionBtn: $id("select-selection"),
  selectBrushBtn: $id("select-brush"),
  selectEraserBtn: $id("select-eraser"),
  selectLiquifyBtn: $id("select-liquify"),

  zoomArea: $id("zoom-area"),
  selectionArea: $id("selection-area"),

  sizeValue: $id("size-value"),
  opacityValue: $id("opacity-value")!,
  sizeSlider: $id<HTMLInputElement>("size-slider"),
  opacitySlider: $id<HTMLInputElement>("opacity-slider"),

  handleLT: $id("handle-lt"),
  handleT: $id("handle-t"),
  handleRT: $id("handle-rt"),
  handleR: $id("handle-r"),
  handleRB: $id("handle-rb"),
  handleB: $id("handle-b"),
  handleLB: $id("handle-lb"),
  handleL: $id("handle-l"),

  chooseColor: $id("choose-color"),
  colorIcon: $id("color-icon"),

  colorElements: $id("color-box").querySelectorAll(".select-color")!,

  selectionSizeBox: $id("selection-size"),
  selectionText: $id("selection-text"),

  positionBox: $id("cursor-position"),
  positionText: $id("cursor-position-text"),

  titleArea: $id("title-area"),
  canvasTitle: $id("canvas-title"),

};

export function getElements() {
  $id("selection-icon").innerHTML = SelectionSvg;
  $id("brush-icon").innerHTML = BrushSvg;
  $id("eraser-icon").innerHTML = EraserSvg;
  $id("liquify-icon").innerHTML = LiquifySvg;

  $id("menu-icon").innerHTML = MenuSvg;
  $id("undo-icon").innerHTML = UndoSvg;
  $id("redo-icon").innerHTML = RedoSvg;

  $id("cursor-icon").innerHTML = CursorSvg;
}


/** file.ts */ 
import { els } from "./elements";
import { getLayerWorker } from "./worker/workerPool";
//import { encode } from "fast-png";
import { encode } from "@jsquash/png";
import * as Comlink from "comlink";
import { cutSelection, makeSelectionFromBitmap, selection } from "./selection";
import {
  getPixelRatio,
  position,
  setCameraPosition,
} from "./position";
import { paintState } from "./main";

export function addClipboardEvent() {
  // 드래그가 영역 위로 올라왔을 때 기본 이벤트 방지
  els.container.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  // 실제 드롭이 발생했을 때
  els.container.addEventListener("drop", async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt || !dt.files.length) return;

    // 여러 파일을 드롭할 수도 있으므로 루프
    for (const file of dt.files) {
      // 이미지 파일인지 확인
      if (file.type.startsWith("image/")) {
        try {
          // 파일을 ImageBitmap으로 변환
          const bitmap = await createImageBitmap(file, {
            imageOrientation: "flipY",
            premultiplyAlpha: "premultiply",
          });
          console.log("드래그 앤 드롭으로 가져온 이미지:", file.name);

          if (false && paintState.changed) {
            makeSelectionFromBitmap(bitmap);
          } else {
            uploadImage(bitmap);
          }
        } catch (err) {
          console.error("드롭된 이미지를 처리 중 에러:", err);
        }
      } else {
        console.warn("이미지 형식이 아닌 파일은 무시합니다:", file.type);
      }
    }
  });

  function uploadImage(bitmap: ImageBitmap) {
    let dpr = getPixelRatio();

    console.log(position.bouncingRect.width, bitmap.width);
    let val = 1.125 / dpr;
    let xScale = position.bouncingRect.width / (bitmap.width * val);
    let yScale = position.bouncingRect.height / (bitmap.height * val);
    let scale = Math.min(xScale, yScale);

    let x = (position.bouncingRect.width - bitmap.width * scale) / 2 / scale;
    let y = (position.bouncingRect.height - bitmap.height * scale) / 2 / scale;

    position.setScale(scale);
    position.setX(x);
    position.setY(y);
    position.setWidth(bitmap.width);
    position.setHeight(bitmap.height);
    setCameraPosition();

    const worker = getLayerWorker();
    worker.uploadImage(Comlink.transfer(bitmap, [bitmap]));
  }

  // 붙여넣기
  window.addEventListener("paste", async (event: ClipboardEvent) => {
    //  const clipboardItems = await navigator.clipboard.read();
    // console.log("clipboardItems", clipboardItems);
    // for (const item of clipboardItems) {
    //   console.log("클립보드 아이템:", item);
    //   // 텍스트 데이터 처리
    //   if (item.types.includes('text/plain')) {
    //     const text = await item.getType('text/plain');
    //     console.log('텍스트 데이터:', text);
    //   }
    // }

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      console.log(item);

      // // 클립보드의 데이터 타입이 text/html일 때
      // if (item.type === "text/html") {
      //   item.getAsString((htmlContent) => {
      //     // base64로 인코딩된 데이터를 찾을 수 있는 경우
      //     const base64Pattern = /<!--\(figmeta\)(.*?)\(\/figmeta\)-->/;
      //     const match = htmlContent.match(base64Pattern);
      //     if (match && match[1]) {
      //       // base64로 인코딩된 부분을 추출하고 디코딩
      //       const decoded = window.atob(match[1]);
      //       console.log(decoded); // 디코딩된 데이터를 확인
      //     } else {
      //       console.log("No base64 encoded data found");
      //     }
      //   });
      // }
      if (item.kind === "string") {
        item.getAsString((str) => {
          console.log(str);
        });
      }
      if (item.kind === "file") {
        let file = item.getAsFile();
        console.log(file);
      }

      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;

        const bitmap = await createImageBitmap(blob, {
          imageOrientation: "flipY",
          premultiplyAlpha: "premultiply",
        });

        event.preventDefault(); // 기본 동작 막기
        console.log("onpaste 이미지 붙여넣기 실행!");
        if (paintState.changed) {
          makeSelectionFromBitmap(bitmap);
        } else {
          uploadImage(bitmap);
        }
      }
    }
  });

  // 복사
  window.addEventListener("copy", (event: ClipboardEvent) => {
    event.preventDefault();
    if (selection.visible) {
      let worker = getLayerWorker();
      worker.copy();
    }
  });

  // 잘라내기 = 복사와 동일, 나중에 cut 전용 로직 넣어도 됨
  window.addEventListener("cut", (event: ClipboardEvent) => {
    event.preventDefault();
    if (selection.visible) {
      let worker = getLayerWorker();
      worker.cut();
    }

    cutSelection();
  });
}

export async function copyPixelsToClipboard(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const imageData = new ImageData(pixels, width, height);

  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = await encode(imageData);

  // 2. Blob 생성
  const blob = new Blob([pngData], { type: "image/png" });
  const item = new ClipboardItem({ "image/png": blob });
  await navigator.clipboard.write([item]);

  console.log("클립보드 복사 완료!!");
}


/** interaction.ts */ 
import { paintState } from "./main";
import { cancel, toolManager } from "./draw";
import { els } from "./elements";
import { applySelection, canvasSelect, selectionDelete } from "./selection";
import { position } from "./position";

/**
 * 단축키
 */
const pressedKeys = {
    Space: false,
    KeyZ: false,
    setSpace(value) {
        this.Space = value;
        applyKeyAction();
    },
    setKeyZ(value) {
        this.KeyZ = value;
        applyKeyAction();
    },
};

function addClickEventListener() {
    els.selectBrushBtn.addEventListener("click", () => {
        toolManager.setBrushTool();
    });

    els.selectEraserBtn.addEventListener("click", () => {
        toolManager.setEraserTool();
    });

    els.selectLiquifyBtn.addEventListener("click", () => {
        toolManager.setLiquifyTool();
    });

    els.selectSelectionBtn.addEventListener("click", () => {
        toolManager.setSelectTool();
    });

    const hexColors = [
        "#000000",
        "#FFFFFF",
        "#FF6F61",
        "#98FF98",
        "#FFA75F",
        "#ACE7FF",
        "#FFED65",
        "#E5B5FF",
    ];

    els.colorElements.forEach((selectDiv, index) => {
        const hexColor = hexColors[index];
        const circle = selectDiv.querySelector(
            ".circle-shape",
        ) as HTMLDivElement;

        if (!circle) return;

        // 배경색 적용
        circle.style.backgroundColor = hexColor;

        // 흰색일 경우 테두리 추가
        if (hexColor.toUpperCase() === "#FFFFFF") {
            circle.style.border = "1px solid #E3E3E3";
        }

        // 클릭 시 색상 설정
        selectDiv.addEventListener("click", () => {
            let { r, g, b } = hexToRgb(hexColor);
            paintState.setColor(r, g, b);
        });
    });
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");

    // 3자리 짧은 hex (#fff) → 확장
    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return { r, g, b };
}

export function addInteractionEvent() {
    addClickEventListener();
    addKeyActionChangeEventListener();

    // 슬라이더 이벤트
    (function () {
        els.sizeSlider.addEventListener("input", (event) => {
            const size = Number(els.sizeSlider.value);
            let realSize = positionToSize(size / 1000);
            console.log("브러시 크기:", realSize);
            paintState.setBrushSize(realSize);
        });

        els.opacitySlider.addEventListener("input", (event) => {
            const alpha = Math.round(Number(els.opacitySlider.value));
            console.log("투명도:", alpha);
            paintState.setBrushAlpha(alpha);
        });
    })();
    function positionToSize(pos: number): number {
        const min = 1;
        const max = 3000;
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logValue = logMin + (logMax - logMin) * pos;
        return Math.exp(logValue);
    }

    // 키보드 이벤트
    (function () {
        document.addEventListener("keydown", (event) => {
            if (
                event.code === "Space" ||
                event.code === "Tab" ||
                event.code == "Enter"
            ) {
                event.preventDefault();
            }

            if (event.code === "Space") {
                event.preventDefault();

                pressedKeys.setSpace(true);
            }

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys.setKeyZ(true);
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.
            }

            //console.log("키다운");
            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code === "AltLeft") {
                paintState.setShowCircle(true);
            }

            if (event.code === "Escape") {
                event.preventDefault();

                cancel();
            }

            if (event.code === "Delete") {
                selectionDelete();
            }

            if ((event.ctrlKey || event.metaKey) && event.code === "KeyA") {
                event.preventDefault();
                applySelection();

                canvasSelect(0, 0, position.width, position.height);
            }
            if (event.code === "KeyB") {
                toolManager.setBrushTool();
            }
            if (event.code === "KeyE") {
                toolManager.setEraserTool();
            }
            if (event.code === "KeyL") {
                toolManager.setLiquifyTool();
            }
            if (event.code === "KeyS") {
                toolManager.setSelectTool();
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys.setKeyZ(false);
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys.setSpace(false);
            }
            if (event.code === "AltLeft") {
                event.preventDefault();
                //console.log("알트 업", event);
                paintState.setShowCircle(false);
            }
        });
    })();

    // 커서 위치 이벤트
    (function () {
        els.container.addEventListener(
            "pointerdown",
            (_) => {
                paintState.setPointerdown(true);

                // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
            },
            true,
        );

        window.addEventListener(
            "pointerup",
            (_) => {
                paintState.setPointerdown(false);
                paintState.setDrawdownAndMoved(false);
                // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
            },
            true,
        );

        window.addEventListener(
            "pointermove",
            (event) => {
                if (event.pointerType == "mouse") {
                    // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
                    paintState.setCursorPosition(event.clientX, event.clientY);
                }
            },
            true,
        );
    })();

    //
    window.addEventListener("contextmenu", (event) => event.preventDefault());
}

// 누르고 있는 키에 따라서 도구를 바꿈
function applyKeyAction() {
    if (paintState.pointerdown) {
        return;
    }
    paintState.setAction("BRUSH");

    // 이전에 뭔가 작동중이면 안바꿈
    if (pressedKeys.Space) {
        paintState.setAction("PAN");
    }
    if (pressedKeys.KeyZ) {
        console.log("zoom 누르는중");
        paintState.setAction("ZOOM");
    }
}

function addKeyActionChangeEventListener() {
    // 이건 다른 pointerup이 모두 실행 된 이후.
    window.addEventListener("pointerup", (e) => {
        e.preventDefault();

        // 키보드를 떼면 눌려있는 키가 적용되어야 한다.
        setTimeout(() => {
            applyKeyAction(); // 가장 마지막에 작동하게 함
        }, 0);
    });
}


/** main.ts */ 
import { addDrawEvent, tranferCanvas } from "./draw";
import {
    addPositionEvent,
    getPixelRatio,
    position,
    render,
    resizeScreen,
    setDefaultPosition,
    updateBouncingRect,
} from "./position";
import { els, getElements } from "./elements";
import { addInteractionEvent } from "./interaction";
import { addSelectionEvent, applySelection } from "./selection";
import { addClipboardEvent } from "./file";
import { makeAutoObservable } from "mobx";
import { bindView } from "./view";
import { getLayerWorker } from "./worker/workerPool";

window.onload = main;

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection" | 'resize'; // 선택창 풀면 brush로 됌
type BrushId = "brush" | "eraser" | "liquify";
class PaintState {
    action: Action = "BRUSH";
    toolId: ToolId = "brush";
    brushId: BrushId = "brush";
    private brushSize = { brush: 5, eraser: 10, liquify: 50 };
    private brushAlpha = { brush: 100, eraser: 100, liquify: 100 };
    color = { r: 30, g: 30, b: 30 };
    cursorX = 0;
    cursorY = 0;

    pointerdown = false;
    drawdownAndMoved = false;

    targetId = "brush";

    changed = false;
    showCircle = false;
    appbarHeight = 0;

    showSizeHandle = false;
    constructor() {
        makeAutoObservable(this);
    }

    setAction(val: Action) {
        this.action = val;
    }
    setToolId(toolId: ToolId) {
        this.toolId = toolId;
    }
    setBrushId(brushId: BrushId) {
        this.brushId = brushId;
        this.targetId = brushId;
    }
    setPointerdown(val: boolean) {
        this.pointerdown = val;
    }
    setDrawdownAndMoved(val: boolean) {
        this.drawdownAndMoved = val;
    }
    setCursorPosition(x, y) {
        this.cursorX = x;
        this.cursorY = y;
    }
    setBrushSize(size: number) {
        this.brushSize[this.targetId] = size;
        const worker = getLayerWorker();
        worker.setStrokeSize(size);
    }
    setBrushAlpha(alpha: number) {
        this.brushAlpha[this.targetId] = alpha;
    }

    setColor(r: number, g: number, b: number) {
        this.color = { r, g, b };
    }
    setShowCircle(value) {
        this.showCircle = value;
    }

    setShowSizeHandle(val) {
        this.showSizeHandle = val;
    }

    getBrushSize() {
        return this.brushSize[this.targetId];
    }
    getBrushAlpha() {
        return this.brushAlpha[this.targetId];
    }
    getColor() {
        return this.color;
    }
}

export const paintState = new PaintState();

async function main() {
    console.log("Start App!");

    getElements();
    setContainerWidth();

    // 초기 캔버스 위치 계산
    setDefaultPosition();

    // 뷰 바인딩
    bindView();

    // 이벤트 추가
    addInteractionEvent();

    addClipboardEvent();

    addPositionEvent();

    addDrawEvent();

    addSelectionEvent();

    // dpr이 1이 아니면, 캔버스 확대
    setCanvasCSSSize();

    // 캔버스 업로드
    await tranferCanvas();

    console.log("Complete App!");

    globalThis.position = position;
    globalThis.paintState = paintState;

    window.addEventListener("resize", async function () {
        debounce(async () => {
            console.log("debounce");
            updateBouncingRect();
            setContainerWidth();
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

function setContainerWidth() {
    const hiddenAppbar = document.getElementById("header-space");
    const appbar = document.getElementById("appbar");

    if (hiddenAppbar && appbar) {
        paintState.appbarHeight = appbar.offsetHeight;
        hiddenAppbar.style.height = appbar.offsetHeight + "px";
    }
}

let timer;
function debounce(func, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
        func();
    }, delay);
}


/** position.ts */ 
import { paintState } from "./main";
import { cancel, endDrawing } from "./draw";
import { els } from "./elements";
import { getLayerWorker } from "./worker/workerPool";
import { makeAutoObservable } from "mobx";
import { clamp, selection } from "./selection";

const MIN_SCALE = 0.125;
let MAX_SCALE = 0;

export class PositionState {
  x = 10;
  y = 10;
  width = 10;
  height = 10;
  scale = 1;
  dpr = 3;
  bouncingRect = { x: 0, y: 0, width: 0, height: 0 };

  setBouncingRect(rect) {
    this.bouncingRect = rect;
  }

  constructor() {
    makeAutoObservable(this);
  }

  setX(x: number) {
    this.x = x;
  }

  setY(y: number) {
    this.y = y;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setScale(scale: number) {
    this.scale = scale;
  }
}

export const position = new PositionState();

export function updateBouncingRect() {
  console.log("updateBouncingRect");
  position.setBouncingRect(els.container.getBoundingClientRect());
}
export async function setCameraPosition() {
  const minW = -position.width;
  const maxW = position.bouncingRect.width / position.scale;
  const clampX = Math.min(maxW, Math.max(minW, position.x));

  const minH = -position.height;
  const maxH = position.bouncingRect.height / position.scale;
  const clampY = Math.min(maxH, Math.max(minH, position.y));

  position.setX(clampX);
  position.setY(clampY);

  const worker = getLayerWorker();
  const pxRatio = getPixelRatio();

  await worker.setCamaraPosition(
    position.x * pxRatio,
    position.y * pxRatio,
    position.scale,
  );
}

export async function resizeScreen() {
  const worker = getLayerWorker();
  const pxRatio = getPixelRatio();
  await worker.resizeScreenSize(
    position.bouncingRect.width * pxRatio,
    position.bouncingRect.height * pxRatio,
  );
}

export function render() {
  const worker = getLayerWorker();
  worker.render();
}

export async function renderChangedPosition() {
  setCameraPosition();
  render();
}

export function setDefaultPosition() {
  updateBouncingRect();

  // 초기 위치 설정
  let percent = 2 / 3;
  let dpr = getPixelRatio();
  let scaledDpr = dpr * percent;
  let width, height;

  if (position.bouncingRect.width > position.bouncingRect.height) {
    // 가로가 김
    width = position.bouncingRect.height * scaledDpr * 1.414;
    height = position.bouncingRect.height * scaledDpr;
  } else {
    // 세로가 김
    width = position.bouncingRect.width * scaledDpr;
    height = position.bouncingRect.width * scaledDpr * 1.414;
  }
  position.dpr = dpr;
  MAX_SCALE = 120 * dpr;

  // 초기 위치 설정
  let x = (position.bouncingRect.width - width / dpr) / 2;
  let y = (position.bouncingRect.height - height / dpr) / 2;

  position.setScale(1);
  position.setWidth(Math.floor(width));
  position.setHeight(Math.floor(height));
  position.setX(Math.floor(x));
  position.setY(Math.floor(y));
}

export function addPositionEvent() {
  addWheelListener();

  addPinchListener();

  addPanningListener();

  addZoomListener();

  addCanvasResizeHandleEvent();
}

function addWheelListener() {
  /**
   * 휠 스크롤 영역
   */
  (function () {
    window.addEventListener(
      "wheel",
      (event) => {
        // console.log("wheel", event);

        if (event.ctrlKey) {
          event.preventDefault();
          let new_mag;
          if (event.deltaY > 0) {
            new_mag = position.scale / 1.2;
          } else {
            new_mag = position.scale * 1.2;
          }
          const clamped_scale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, new_mag),
          );
          setMagification(
            clamped_scale,
            to_screen_coord(event.clientX, event.clientY),
          );

          // updateCursorShape();
        } else if (event.altKey) {
          let brushSize = paintState.getBrushSize();
          let percent =
            event.deltaY > 0 ? (brushSize - 1) / 1.1 : (brushSize + 1) * 1.1;
          let newSize = Math.round(clamp(percent, 1, 3000));
          paintState.setBrushSize(newSize);
        } else {
          if (event.shiftKey) {
            let delta = event.deltaY;
            position.setX(position.x - delta / position.scale);
          } else {
            let delta = event.deltaY;
            position.setY(position.y - delta / position.scale);
          }
        }

        renderChangedPosition();
      },
      { passive: false },
    );
  })();
}
function addPinchListener() {
  function setPinchEvent() {
    paintState.setAction("PINCH");
  }

  function setLastTool() {
    paintState.setAction("BRUSH");
  }

  /**
   * 핀지줌 영역
   */
  (function () {
    let pointerIndex = 0;

    let lastPinchDistance;
    let lastPinchCenterPos;
    let firstPointerTime = 0;
    let lastDoubleTouchTime = 0;

    const twoFingerTapInterval = 75; // 이중클릭 범위
    const doubleTapInterval = 250; // 더블클릭 범위

    function averageTouches() {
      if (pointers.size < 2) throw new Error("포인터가 2개 미만"); // 포인터가 2개 미만이면 평균 계산 불가

      // 1. pointerId를 오름차순 정렬하여 가장 낮은 두 개 선택
      const sortedPointers = [...pointers.values()].sort(
        (a, b) => a.index - b.index,
      );
      const firstPoint = sortedPointers[0];
      const secondPoint = sortedPointers[1];

      // 3. 두 포인터의 평균 좌표 계산
      return {
        x: (firstPoint.clientX + secondPoint.clientX) / 2,
        y: (firstPoint.clientY + secondPoint.clientY) / 2,
      };
    }

    document.addEventListener("gesturestart", (event) => {
      event.preventDefault();
    });

    let pointers = new Map(); // pointerId -> {x, y} 저장

    window.addEventListener(
      "pointerdown",
      (event) => {
        //console.log("pointerdown - captured", event.pointerId);

        if (!pointers.has(event.pointerId)) {
          // console.log("포인터 추가", event.pointerId);
          pointers.set(event.pointerId, {
            index: pointerIndex,
            clientX: event.clientX,
            clientY: event.clientY,
          });
          pointerIndex++;
        } else {
          alert("포인터 아이디가 이미 있는데 또 pointerdown? 버그임");
        }

        // 핀치 줌
        if (pointers.size === 1) {
          firstPointerTime = performance.now();
        }

        if (pointers.size === 2) {
          const elapsed = performance.now() - firstPointerTime;
          if (elapsed <= twoFingerTapInterval) {
            cancel();
            let now = performance.now();
            if (now - lastDoubleTouchTime <= doubleTapInterval) {
              alert(`더블터치! ${now - lastDoubleTouchTime}`);
              lastDoubleTouchTime = 0;
            } else {
              lastDoubleTouchTime = now;
            }
          } else {
            endDrawing();
          }

          console.log("두 손가락 감지됨, 핀치 줌 시작");
          setPinchEvent();

          lastPinchCenterPos = averageTouches();
          const points = Array.from(pointers.values());
          lastPinchDistance = Math.hypot(
            points[0].clientX - points[1].clientX,
            points[0].clientY - points[1].clientY,
          );
        }
      },
      true,
    );

    let moveDistance = 0;

    window.addEventListener(
      "pointermove",
      (event) => {
        if (!pointers.has(event.pointerId)) return;
        if (pointers.size == 1) {
          let lastPointer = pointers.get(event.pointerId);
          let distance = Math.hypot(
            lastPointer.x - event.clientX,
            lastPointer.y - event.clientY,
          );
          moveDistance += distance;
        }
        Object.assign(pointers.get(event.pointerId), {
          clientX: event.clientX,
          clientY: event.clientY,
        });

        // 핀치 줌
        if (paintState.action !== "PINCH") return;
        if (pointers.size < 2) return; // 두 손가락이 없으면 무시

        const pinchCenterPos = averageTouches();
        const dx = lastPinchCenterPos.x - pinchCenterPos.x;
        const dy = lastPinchCenterPos.y - pinchCenterPos.y;

        position.setX(position.x - dx / position.scale);
        position.setY(position.y - dy / position.scale);
        lastPinchCenterPos = pinchCenterPos;

        const points = Array.from(pointers.values());
        const distance = Math.hypot(
          points[0].clientX - points[1].clientX,
          points[0].clientY - points[1].clientY,
        );

        const scaleFactor = distance / lastPinchDistance;
        let newScale = position.scale * scaleFactor;
        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

        setMagification(
          clampedScale,
          to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
        );
        lastPinchDistance = distance;

        renderChangedPosition();
      },
      true,
    );

    window.addEventListener(
      "pointerup",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          // console.log("포인터 제거!", event.pointerId);
        }

        // 핀치 줌
        if (paintState.action !== "PINCH") return;

        if (pointers.size == 0) {
          setLastTool();
        }
      },
      true,
    );

    window.addEventListener(
      "pointercancel",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          console.log("포인터 제거!", event.pointerId);
        }
      },
      true,
    );
  })();
}
function addPanningListener() {
  /**
   * 마우스 팬 영역
   */
  (function () {
    let lastClientX;
    let lastClientY;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "PAN") return;

      lastClientX = e.clientX;
      lastClientY = e.clientY;

      console.log("팬 시작!");
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "PAN") return;
      if (!paintState.pointerdown) return;

      let dx = lastClientX - e.clientX;
      let dy = lastClientY - e.clientY;
      let x = position.x - dx / position.scale;
      let y = position.y - dy / position.scale;
      position.setX(x);
      position.setY(y);

      lastClientX = e.clientX;
      lastClientY = e.clientY;
      renderChangedPosition();
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "PAN") return;
    });
  })();
}
function addZoomListener() {
  /**
   * 줌 영역
   */
  (function () {
    let sx, sy;
    let ex, ey;
    let activeZoom = false;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "ZOOM") return;
      if (activeZoom) return;
      sx = e.clientX;
      sy = e.clientY;
      ex = e.clientX;
      ey = e.clientY;
      activeZoom = true;

      els.zoomArea.style.visibility = "visible";
      console.log("확대");
      els.zoomArea.style.left = `${sx}px`;
      els.zoomArea.style.top = `${sy}px`;
      els.zoomArea.style.width = `0px`;
      els.zoomArea.style.height = `0px`;
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!paintState.pointerdown) return;
      if (!activeZoom) return;
      ex = e.clientX;
      ey = e.clientY;
      let startX = sx < ex ? sx : ex;
      let startY = sy < ey ? sy : ey;
      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);
      els.zoomArea.style.left = `${startX}px`;
      els.zoomArea.style.top = `${startY}px`;
      els.zoomArea.style.width = `${zoomW}px`;
      els.zoomArea.style.height = `${zoomH}px`;
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!activeZoom) return;

      els.zoomArea.style.visibility = "hidden";
      let cx = (sx + ex) / 2;
      let cy = (sy + ey) / 2;

      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);

      // 그냥 클릭 시
      if (zoomW < 10 || zoomH < 10) {
        let new_mag = position.scale;
        if (e.button === 0) {
          new_mag = position.scale * 1.5;
        } else if (e.button === 2) {
          new_mag = position.scale / 1.5;
        }
        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));
        setMagification(clamped_scale, to_screen_coord(e.clientX, e.clientY));
      } else {
        let px = position.bouncingRect.width / zoomW;
        let py = position.bouncingRect.height / zoomH;
        let minScale = px < py ? px : py;

        let topMargin = position.bouncingRect.y;
        let centerX = position.bouncingRect.width / 2;
        let centerY = position.bouncingRect.height / 2;

        let dx = cx - centerX;
        let dy = cy - centerY - topMargin / minScale;
        position.setX(position.x - dx / position.scale);
        position.setY(position.y - dy / position.scale);

        let new_mag = position.scale * minScale;

        // if (e.button === 0) {
        //   new_mag = position.scale * minScale;
        // } else if (e.button === 2) {
        //   new_mag = position.scale / minScale;
        // }

        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));

        setMagification(clamped_scale, to_screen_coord(centerX, centerY));
      }

      renderChangedPosition();

      activeZoom = false;
    });
  })();
}

function setMagification(new_scale, anchor_point) {
  // 확대 전 값을 따로 보관
  const old_scale = position.scale;
  const old_x = position.x;
  const old_y = position.y;

  // 배율만 미리 바꿔놓든, 나중에 바꾸든 상관없지만
  // old_scale를 반드시 먼저 따로 보관하고 써야 함
  position.setScale(new_scale);

  // 화면에서 anchor_point가 고정되려면,
  // (anchor + position)의 스크린 좌표가
  // old_scale 시절과 new_scale 시절이 같아야 함
  //
  // 즉,
  //   (anchor + oldPos) * old_scale  ==  (anchor + newPos) * new_scale
  //
  // 풀어서 새 newPos를 구하면 아래와 같은 공식이 됩니다.
  let newX =
    ((anchor_point.x + old_x) * old_scale) / new_scale - anchor_point.x;
  let newY =
    ((anchor_point.y + old_y) * old_scale) / new_scale - anchor_point.y;
  position.setX(newX);
  position.setY(newY);
}

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  let p = to_screen_coord(x, y);
  let px = p.x * getPixelRatio();
  let py = p.y * getPixelRatio();

  return { x: px, y: py };
}

function to_world_coord(screenX, screenY) {
  let worldX =
    (screenX + position.x) * position.scale + position.bouncingRect.x;
  let worldY =
    (screenY + position.y) * position.scale + position.bouncingRect.y;
  return { x: worldX, y: worldY };
}
// 캔버스 픽셀 좌표 → 스크린 좌표로 역변환 함수
function canvas_coord_to_screen_coord(canvasX, canvasY) {
  let px = canvasX / getPixelRatio();
  let py = canvasY / getPixelRatio();
  return { x: px, y: py };
}

export function canvas_coord_to_css_coord({ x, y }) {
  const screen = canvas_coord_to_screen_coord(x, y);
  const world = to_world_coord(screen.x, screen.y);
  return world;
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px = (x - position.bouncingRect.x) / position.scale - position.x;
  let py = (y - position.bouncingRect.y) / position.scale - position.y;
  return { x: px, y: py };
}

export function to_pixel_canvas_coord(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
  };
}
export function to_pixel_canvas_coord_round(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

export async function changeCanvasSize(x, y, newWidth, newHeight) {
  position.setWidth(newWidth);
  position.setHeight(newHeight);

  const worker = getLayerWorker();

  await worker.resizeLayer(x, y, newWidth, newHeight);
  renderChangedPosition();
}

let dpr;
export function getPixelRatio() {
  if (!dpr) {
    dpr = window.devicePixelRatio;
  }
  return dpr;
}

function addCanvasResizeHandleEvent() {
  els.titleArea.addEventListener("pointerup", () => {
    // paintState.setShowSizeHandle(true);
    selection.setWidth(position.width);
    selection.setHeight(position.height);
    selection.setX(0);
    selection.setY(0);

    paintState.setToolId("resize");
    console.log('title click!')
  });
}


/** selection.ts */ 
import { paintState } from "./main";
import { els } from "./elements";
import {
  changeCanvasSize,
  getPixelRatio,
  position,
  to_pixel_canvas_coord,
} from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { makeAutoObservable } from "mobx";

export class SelectionState {
  x = 0;
  y = 0;
  width = 300;
  height = 200;
  visible = false;
  showHint = false;
  active = false;

  constructor() {
    makeAutoObservable(this);
  }
  setX(x: number) {
    this.x = x;
  }

  setY(y: number) {
    this.y = y;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }
  hideHint(val: boolean) {
    this.showHint = val;
  }
}

export const selection = new SelectionState();

let beforeSelectionPos = {
  x: 0,
  y: 0,
  width: 50,
  height: 50,
};

export function addSelectionEvent() {
  addMakeSelectionEventListener();
  addSelectionDragEventListener();
  addHandleEventListener();

  // 외부 클릭하면 선택창 취소
  (function () {
    let startTime;
    let selectionDown = false;
    els.container.addEventListener("pointerdown", function (e) {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "selection" && paintState.toolId != "resize")
        return;
      if (!paintState.pointerdown) return;

      const blockedElement = document.getElementById("selections")!; // A 엘리먼트
      if (blockedElement.contains(e.target as Node)) return; // A 또는 자식 위면 무시

      selectionDown = true;
      startTime = performance.now();
      console.log("selection pointerdown");
    });

    els.container.addEventListener("pointerup", function (e) {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "selection" && paintState.toolId != "resize")
        return;
      if (!selectionDown) return;
      if (paintState.toolId == "resize") {
        paintState.setToolId("brush");
        selectionDown = false;
        return;
      }

      let now = performance.now();
      if (now - startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        paintState.setToolId("select");
      }

      selectionDown = false;
    });
  })();
}
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function addMakeSelectionEventListener() {
  (function () {
    let startPoint;
    let endPoint;

    let sp, ep;

    let activeSelect = false;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      let px = clamp(point.x, 0, position.width);
      let py = clamp(point.y, 0, position.height);
      startPoint = { x: px, y: py };
      endPoint = { x: px, y: py };

      sp = {
        x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
        y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
      };

      ep = {
        x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
        y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
      };

      activeSelect = true;

      console.log("선택 시작");
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      if (!paintState.pointerdown) return;
      if (!activeSelect) return;

      selection.hideHint(true);

      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      let px = clamp(point.x, 0, position.width);
      let py = clamp(point.y, 0, position.height);
      endPoint = { x: px, y: py };

      sp = {
        x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
        y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
      };

      ep = {
        x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
        y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
      };

      let startX = Math.min(sp.x, ep.x);
      let startY = Math.min(sp.y, ep.y);
      let zoomW = Math.abs(sp.x - ep.x);
      let zoomH = Math.abs(sp.y - ep.y);

      selection.setX(startX);
      selection.setY(startY);
      selection.setWidth(zoomW);
      selection.setHeight(zoomH);
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      if (!activeSelect) return;
      activeSelect = false;

      els.selectionArea.style.visibility = "hidden";

      let startX = Math.min(sp.x, ep.x);
      let startY = Math.min(sp.y, ep.y);
      let zoomW = Math.abs(sp.x - ep.x);
      let zoomH = Math.abs(sp.y - ep.y);

      if (zoomH == 0 || zoomW == 0) {
        console.error("선택창이 0이 나올 수 없는데?");
        return;
      }
      if (zoomH == 1 && zoomH == 1) {
        console.log("1 x 1 선택창은 만들지 않습니다.");
        return;
      }

      selection.hideHint(false);
      canvasSelect(startX, startY, zoomW, zoomH);
    });
  })();
}

function addSelectionDragEventListener() {
  let selectionDragPointer = { x: 0, y: 0 };
  (function () {
    els.selectionArea.addEventListener(
      "pointerdown",
      function (e: PointerEvent) {
        e.preventDefault();
        if (!paintState.pointerdown) return;
        if (paintState.action != "BRUSH") return;
        if (paintState.toolId != "selection") return;
        let point = to_pixel_canvas_coord(e.clientX, e.clientY);

        console.log("선택창 이동 시작!");
        selection.active = true;

        selectionDragPointer = {
          x: point.x - selection.x,
          y: point.y - selection.y,
        };
      },
    );

    window.addEventListener("pointermove", (e) => {
      e.preventDefault();
      // console.log(to_canvas_coord(e.clientX, e.clientY))
      if (!paintState.pointerdown) return;
      if (paintState.action != "BRUSH") return;
      if (!selection.active) return;

      selection.hideHint(true);
      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      const worker = getLayerWorker();

      let newSelectionX = point.x - selectionDragPointer.x;
      let newSelectionY = point.y - selectionDragPointer.y;

      selection.setPosition(newSelectionX, newSelectionY);

      worker.moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    });

    window.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (paintState.action != "BRUSH") return;
      if (!selection.active) return;

      beforeSelectionPos = {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
      };

      selection.active = false;
      selection.hideHint(false);
    });
  })();
}

let activeHandle: HTMLElement | null = null;

function addHandleEventListener() {
  let worker = getLayerWorker();

  // 드래그 시작 시점의 selection 상태
  let startLeft = 0; // selection.x
  let startTop = 0; // selection.y
  let startWidth = 0; // selection.width
  let startHeight = 0; // selection.height

  let startPoint;
  let endPoint;

  // 핸들 MOUSEDOWN 이벤트 핸들러
  function onMouseDown(e: MouseEvent, handle: HTMLElement) {
    e.preventDefault();
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;

    activeHandle = handle;

    startPoint = { x: selection.x, y: selection.y };
    endPoint = {
      x: selection.x + selection.width - 1,
      y: selection.y + selection.height - 1,
    };

    // selection의 초기 상태 기록
    startLeft = selection.x;
    startTop = selection.y;
    startWidth = selection.width;
    startHeight = selection.height;

    beforeSelectionPos = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
  }

  // 전역 MOUSEMOVE 이벤트 핸들러
  function onMouseMove(e: MouseEvent) {
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    let point = to_pixel_canvas_coord(e.clientX, e.clientY);

    // 시작과 끝을 보고, 어떤 핸들인 지 보고 최종 결과 계산.
    let newX = startLeft;
    let newY = startTop;
    let newWidth = startWidth;
    let newHeight = startHeight;

    if (activeHandle === els.handleRB) {
      newWidth = point.x - startPoint.x + 1;
      newHeight = point.y - startPoint.y + 1;
    }
    if (activeHandle === els.handleLT) {
      newX = startLeft - (startPoint.x - point.x);
      newY = startTop - (startPoint.y - point.y);
      newWidth = endPoint.x - point.x + 1;
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleRT) {
      newY = startTop - (startPoint.y - point.y);
      newWidth = point.x - startPoint.x + 1;
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleLB) {
      newX = startLeft - (startPoint.x - point.x);
      newWidth = endPoint.x - point.x + 1;
      newHeight = point.y - startPoint.y + 1;
    }
    if (activeHandle === els.handleL) {
      newX = startLeft - (startPoint.x - point.x);
      newWidth = endPoint.x - point.x + 1;
    }
    if (activeHandle === els.handleR) {
      newWidth = point.x - startPoint.x + 1;
    }
    if (activeHandle === els.handleT) {
      newY = startTop - (startPoint.y - point.y);
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleB) {
      newHeight = point.y - startPoint.y + 1;
    }

    if (e.shiftKey) {
      const ratio = startWidth / startHeight;
      const currentRatio = newWidth / newHeight;

      if (activeHandle === els.handleL || activeHandle === els.handleR) {
        newHeight = Math.floor(newWidth / ratio);
      } else if (activeHandle === els.handleT || activeHandle === els.handleB) {
        newWidth = Math.floor(newHeight * ratio);
      } else {
        if (currentRatio < ratio) {
          newWidth = Math.floor(newHeight * ratio);
        } else {
          newHeight = Math.floor(newWidth / ratio);
        }
      }

      if (activeHandle === els.handleLT) {
        newX = startLeft + startWidth - newWidth;
        newY = startTop + startHeight - newHeight;
      }
      if (activeHandle === els.handleRT) {
        newY = startTop + startHeight - newHeight;
      }
      if (activeHandle === els.handleLB) {
        newX = startLeft + startWidth - newWidth;
      }
      if (activeHandle === els.handleL) {
        newX = startLeft + startWidth - newWidth;
      }
      if (activeHandle === els.handleT) {
        newY = startTop + startHeight - newHeight;
      }
    }

    const minSize = 1;
    const maxSize = 4096;

    selection.setX(
      clamp(
        newX,
        beforeSelectionPos.x + beforeSelectionPos.width - maxSize,
        beforeSelectionPos.x + beforeSelectionPos.width - minSize,
      ),
    );
    selection.setY(
      clamp(
        newY,
        beforeSelectionPos.y + beforeSelectionPos.height - maxSize,
        beforeSelectionPos.y + beforeSelectionPos.height - minSize,
      ),
    );
    selection.setWidth(clamp(newWidth, minSize, maxSize));
    selection.setHeight(clamp(newHeight, minSize, maxSize));

    if (paintState.toolId == "selection") {
      worker.moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    }

    if (paintState.toolId == "resize") {
    }
  }

  // 전역 MOUSEUP 이벤트 핸들러
  function onMouseUp() {
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    console.log(endPoint);
    activeHandle = null;

    if (paintState.toolId == "resize") {
      position.setX(position.x + selection.x / getPixelRatio());
      position.setY(position.y + selection.y / getPixelRatio());

      let x = selection.x;
      let y = selection.y;
      selection.setX(0);
      selection.setY(0);
      console.log("resize!!!");
      changeCanvasSize(x, y, selection.width, selection.height);
    }

    beforeSelectionPos = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
  }

  // 각 핸들에 mousedown 이벤트 등록
  const handles = [
    els.handleLT,
    els.handleT,
    els.handleRT,
    els.handleR,
    els.handleRB,
    els.handleB,
    els.handleLB,
    els.handleL,
  ];
  for (const handle of handles) {
    handle.addEventListener("pointerdown", (e) => onMouseDown(e, handle));
  }

  // 전역에 mousemove, mouseup 이벤트 등록 (드래그 추적)
  document.addEventListener("pointermove", onMouseMove);
  document.addEventListener("pointerup", onMouseUp);
}

// 비트맵으로 선택창 만들기
export function makeSelectionFromBitmap(bitmap: ImageBitmap) {
  applySelection();

  let worker = getLayerWorker();

  let newWidth = bitmap.width;
  let newHeight = bitmap.height;

  // 선택 영역 설정
  selection.setPosition(
    Math.ceil(Math.max(0, -position.x)),
    Math.ceil(Math.max(0, -position.y)),
  );
  selection.setSize(newWidth, newHeight);

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  // 워커에 붙여넣기 지시
  worker.paste(
    selection.x,
    selection.y,
    selection.width,
    selection.height,
    Comlink.transfer(bitmap, [bitmap]),
  );

  paintState.setToolId("selection");
  selection.setVisible(true);
}

// 해당 구역 선택
export function canvasSelect(x, y, width, height) {
  let worker = getLayerWorker();

  selection.setPosition(x, y);
  selection.setSize(width, height);

  worker.select(selection.x, selection.y, selection.width, selection.height);

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  paintState.setToolId("selection");

  console.log("선택:", x, y, width, height);
  selection.setVisible(true);
}

// 선택창 적용
export function applySelection() {
  let worker = getLayerWorker();

  selection.setVisible(false);
  worker.applySelection();
  paintState.changed = true;
}

// 자르기 한 이후에
export function cutSelection() {
  paintState.setToolId("select");
  selection.setVisible(false);
}

export function selectionDelete() {
  paintState.setToolId("select");
  selection.setVisible(false);

  let worker = getLayerWorker();
  worker.selectionDelete();
}

// 선택창 캔슬
export function selectionCancel() {
  if (paintState.pointerdown) {
    selection.active = false;

    selection.setX(beforeSelectionPos.x);
    selection.setY(beforeSelectionPos.y);
    selection.setWidth(beforeSelectionPos.width);
    selection.setHeight(beforeSelectionPos.height);

    const worker = getLayerWorker();

    worker.moveSelection(
      selection.x,
      selection.y,
      selection.width,
      selection.height,
    );

    activeHandle = null;

    selection.hideHint(false);
  } else {
    applySelection();
    paintState.setToolId("select");
  }
}


/** view.ts */ 
import { paintState } from "./main";
import { autorun } from "mobx";
import { els, getElements } from "./elements";
import { selection } from "./selection";
import { getPixelRatio, position, to_canvas_coord } from "./position";

export function bindView() {
    bindToolButtonUI();
    bindSliderUI();
    bindColorUI();
    bindCursorUI();
    bindSelectionUI();
    bindCursorPositionUI();
    bindTitleUI();
}

function bindToolButtonUI() {
    autorun(() => {
        const brushId = paintState.brushId;
        const toolId = paintState.toolId;
        els.selectBrushBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "brush",
        );
        els.selectEraserBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "eraser",
        );
        els.selectLiquifyBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "liquify",
        );
        els.selectSelectionBtn.classList.toggle(
            "selected",
            toolId === "select" || toolId === "selection",
        );
    });
}
function sizeToPosition(size: number): number {
    const min = 1;
    const max = 3000;
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    return ((Math.log(size) - logMin) / (logMax - logMin)) * 1000;
}
function bindSliderUI() {
    autorun(() => {
        const brushSize = paintState.getBrushSize();

        let sizeText = brushSize.toFixed(1);
        if (sizeText.endsWith(".0")) {
            sizeText = sizeText.slice(0, -2);
        }
        els.sizeValue.innerText = `${sizeText}px`;
        els.sizeSlider.value = `${sizeToPosition(brushSize)}`;
    });

    autorun(() => {
        const brushAlpha = paintState.getBrushAlpha();

        els.opacityValue.innerText = `${brushAlpha}%`;
        els.opacitySlider.value = `${brushAlpha}`;
    });
}

function bindCursorUI() {
    const container = els.container;

    // 1. PAN
    autorun(() => {
        const isPan = paintState.action === "PAN";
        container.classList.toggle("grab", isPan && !paintState.pointerdown);
        container.classList.toggle("grabbing", isPan && paintState.pointerdown);
    });

    // 2. ZOOM
    autorun(() => {
        container.classList.toggle("zoom", paintState.action === "ZOOM");
    });

    // 3. SELECT 툴 (BRUSH 모드 + select 툴)
    autorun(() => {
        const isBrush = paintState.action === "BRUSH";
        const isSelectTool = paintState.toolId === "select";
        container.classList.toggle("select", isBrush && isSelectTool);
    });

    const cursor = els.brushCursor;

    autorun(() => {
        const isBrush = paintState.action === "BRUSH";

        const isDrawingTool = paintState.toolId == "brush";
        const isValid = isBrush && isDrawingTool;

        const isDesktop = !("ontouchstart" in window);

        const brushSize = paintState.getBrushSize();
        const dpr = getPixelRatio();

        const scaled = (brushSize * position.scale) / dpr;
        const isBigSize = scaled > 50;
        const showCircle = paintState.showCircle;

        // ───────────── container 클래스
        container.classList.toggle(
            "largeBrush",
            isValid && !showCircle && isBigSize,
        );
        container.classList.toggle(
            "brush",
            isValid && !showCircle && !isBigSize,
        );
        container.classList.toggle("noCursor", isValid && showCircle);

        // ───────────── 브러시 커서 스타일
        if (isValid && (isBigSize || showCircle)) {
            if (isDesktop || paintState.drawdownAndMoved) {
                cursor.style.visibility = "visible";
            } else {
                cursor.style.visibility = "hidden";
            }
            cursor.style.left = `${paintState.cursorX - scaled / 2 - 1}px`;
            cursor.style.top = `${paintState.cursorY - scaled / 2 - 1}px`;
            cursor.style.width = `${scaled}px`;
            cursor.style.height = `${scaled}px`;
        } else {
            cursor.style.visibility = "hidden";
        }
    });
}

function bindSelectionUI() {
    // 1) selectionArea 스타일 갱신
    autorun(() => {
        const visible =
            selection.visible ||
            selection.showHint ||
            paintState.toolId == "resize";

        els.selectionArea.style.visibility = visible ? "visible" : "hidden";
        els.selectionSizeBox.style.visibility = visible ? "visible" : "hidden";

        els.selectionArea.style.pointerEvents =
            paintState.toolId == "resize" ? "none" : "auto";

        const dpr = getPixelRatio();
        const scaledLeft = (selection.x / dpr + position.x) * position.scale;
        const scaledTop = (selection.y / dpr + position.y) * position.scale;
        const scaledWidth = (selection.width * position.scale) / dpr;
        const scaledHeight = (selection.height * position.scale) / dpr;

        if (visible) {
            els.selectionArea.style.left = `${scaledLeft}px`;
            els.selectionArea.style.top = `${scaledTop}px`;
            els.selectionArea.style.width = `${scaledWidth}px`;
            els.selectionArea.style.height = `${scaledHeight}px`;

            els.selectionSizeBox.style.left = `${scaledLeft}px`;
            els.selectionSizeBox.style.top = `${scaledTop + scaledHeight}px`;
            els.selectionSizeBox.style.width = `${scaledWidth}px`;

            els.selectionText.innerText = `${selection.width} x ${selection.height}`;
        }
    });

    // 2) 핸들 위치 및 표시
    autorun(() => {
        const visible =
            (selection.visible && !selection.showHint) ||
            paintState.toolId == "resize";
        const dpr = getPixelRatio();
        let sLeft = (selection.x / dpr + position.x) * position.scale;
        let sTop = (selection.y / dpr + position.y) * position.scale;
        let sWidth = (selection.width * position.scale) / dpr;
        let sHeight = (selection.height * position.scale) / dpr;

        // 핸들 표시/숨김
        const handles = [
            els.handleLT,
            els.handleT,
            els.handleRT,
            els.handleR,
            els.handleRB,
            els.handleB,
            els.handleLB,
            els.handleL,
        ];

        for (const h of handles) {
            h.style.visibility = visible ? "visible" : "hidden";
        }

        // 위치 계산
        const offset = 22;
        const setPos = (handle: HTMLElement, left: number, top: number) => {
            handle.style.left = `${left - offset}px`;
            handle.style.top = `${top - offset}px`;
        };

        if ((selection.height * position.scale) / dpr < 100) {
            for (const h of [els.handleL, els.handleR]) {
                h.style.visibility = "hidden";
            }
        }
        if ((selection.width * position.scale) / dpr < 100) {
            for (const h of [els.handleT, els.handleB]) {
                h.style.visibility = "hidden";
            }
        }

        if (visible) {
            setPos(els.handleLT, sLeft, sTop);
            setPos(els.handleT, sLeft + sWidth / 2, sTop);
            setPos(els.handleRT, sLeft + sWidth, sTop);
            setPos(els.handleR, sLeft + sWidth, sTop + sHeight / 2);
            setPos(els.handleRB, sLeft + sWidth, sTop + sHeight);
            setPos(els.handleB, sLeft + sWidth / 2, sTop + sHeight);
            setPos(els.handleLB, sLeft, sTop + sHeight);
            setPos(els.handleL, sLeft, sTop + sHeight / 2);
        }
    });
}

function bindCursorPositionUI() {
    autorun(() => {
        let point = to_canvas_coord(paintState.cursorX, paintState.cursorY);
        let x = Math.ceil(point.x);
        let y = Math.ceil(point.y);
        let visible =
            0 < x && x <= position.width && 0 < y && y <= position.height;

        els.positionBox.style.visibility = visible ? "visible" : "hidden";
        els.positionText.innerText = `${x} x ${y}`;
    });
}

function bindTitleUI() {
    autorun(() => {
        els.titleArea.style.left = `${position.x * position.scale}px`;
        els.titleArea.style.top = `${position.y * position.scale}px`;
    });

    requestAnimationFrame(()=>{
          els.canvasTitle.innerText = "크기 조정";
    })
      
    
}
function bindResizeHandleUI() {}

function bindColorUI() {
    autorun(() => {
        const color = paintState.getColor();
        els.colorIcon.style.background = rgbToHex(color);
    });
}

function rgbToHex({ r, g, b }) {
    const toHex = (v) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
