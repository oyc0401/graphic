export enum Resolution {
  _2K = 2048, // 4.2MP
  _4K = 4096, // 16.7MP
  _6K = 6144, // 37.7MP
  _8K = 8192, // 67.1MP
}
// HD (720p):     1280 x 720       ≈ 0.9MP
// FHD (1080p):   1920 x 1080      ≈ 2.1MP
// QHD (1440p):   2560 x 1440      ≈ 3.7MP
// 4K UHD:        3840 x 2160      ≈ 8.3MP
// 6K:            6144 x 3160      ≈ 19.4MP
// 8K UHD:        7680 x 4320      ≈ 33.2MP
// 8K DCI:        8192 x 4320      ≈ 35.4MP
export const paintConfig = {
  maxSize: Resolution._4K,
};
import { runApp } from "./app/main";

window.onload = () => {
  console.log("load");
  runApp();
};
declare module "*.svg?react" {
  import * as React from "react";
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare module "*.glsl?raw" {
  const content: string;
  export default content;
}

declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

interface Window {
  showOpenFilePicker?: any;
}
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
/** selection.ts */
import { paintState } from "./paintState";
import { position } from "./position";
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
    showHandle = false;
    active = false; // 작동중인지 확인. 작동중이면 캔슬할 때 돌아감
    hover = "";

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

    setShowHint(val: boolean) {
        this.showHint = val;
    }

    setShowHandle(val: boolean) {
        this.showHandle = val;
    }

    setHover(pos) {
        this.hover = pos;
    }
}

export const selection = new SelectionState();

export let beforeSelectionPos = {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
};

export function setBefore(ele) {
    beforeSelectionPos = ele;
}

let activeHandle: HTMLElement | null = null;

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
    selection.setShowHint(true);
    selection.setShowHandle(true);
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
    selection.setShowHandle(true);
    selection.setShowHint(true);
}

// 선택창 적용
export function applySelection() {
    if (selection.visible) {
        let worker = getLayerWorker();
        worker.applySelection();
    }

    selection.setVisible(false);
    selection.setShowHint(false);
    selection.setShowHandle(false);

    paintState.changed = true;
}

// 자르기 한 이후에
export function cutSelection() {
    paintState.setToolId("select");
    selection.setVisible(false);
    selection.setShowHint(false);
    selection.setShowHandle(false);
}

export function selectionDelete() {
    paintState.setToolId("select");
    selection.setVisible(false);
    selection.setShowHint(false);
    selection.setShowHandle(false);

    let worker = getLayerWorker();
    worker.selectionDelete();
}

// 선택창 캔슬
export function selectionCancel() {
    // 핀치줌으로 인한 캔슬이면 선택창 안 끄기
    if (paintState.pointerdown) {
        selection.active = false;

        if (selection.active) {
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
        }
    } else {
        applySelection();
        paintState.setToolId("select");
    }
}
/** position.ts */
import { els } from "./ui/elements";
import { getLayerWorker } from "./worker/workerPool";
import { makeAutoObservable } from "mobx";

export const MIN_SCALE = 0.125;
export let MAX_SCALE = 0;

export class PositionState {
  x = 10;
  y = 10;
  width = 10;
  height = 10;
  scale = 1;
  dpr = 3;
  bouncingRect = { x: 0, y: 0, width: 0, height: 0 };

  bottomNavHeight = 0;

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

  get screenWidth() {
    return this.bouncingRect.width * getPixelRatio();
  }

  get screenHeight() {
    return this.bouncingRect.height * getPixelRatio();
  }
}

export const position = new PositionState();

export function updateBouncingRect() {
  console.log("updateBouncingRect");
  position.setBouncingRect(els.container.getBoundingClientRect());
}
export async function setCameraPosition() {
  const minW = -position.width;
  const maxW = position.screenWidth / position.scale;
  const clampX = Math.min(maxW, Math.max(minW, position.x));

  const minH = -position.height;
  const maxH = position.screenHeight / position.scale;
  const clampY = Math.min(maxH, Math.max(minH, position.y));

  position.setX(clampX);
  position.setY(clampY);

  const worker = getLayerWorker();
  await worker.setCamaraPosition(position.x, position.y, position.scale);
}

export async function resizeScreen() {
  const worker = getLayerWorker();
  await worker.resizeScreenSize(position.screenWidth, position.screenHeight);
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
  let percent = 7 / 8;
  let dpr = getPixelRatio();
  let width, height;
  let scale = 1;

  const RATIO = Math.SQRT2; // 1.414213562 …
  const { screenWidth: W, screenHeight: H } = position;

  if (W >= H) {
    // ① 가로가 더 길거나 같을 때
    height = H * percent; //   세로를 기준으로 먼저 잡고
    width = height * RATIO; //   가로 길이를 계산
    if (width > W) {
      //   ➜ 가로가 화면을 넘치면?
      width = W * percent; //   가로를 다시 기준으로
      height = width / RATIO; //   세로를 재계산
    }
  } else {
    // ② 세로가 더 길 때
    width = W * percent; //   가로를 기준으로 먼저 잡고
    height = width * RATIO; //   세로 길이를 계산
    if (height > H) {
      //   ➜ 세로가 화면을 넘치면?
      height = H * percent; //   세로를 다시 기준으로
      width = height / RATIO; //   가로를 재계산
    }
  }

  position.dpr = dpr;
  MAX_SCALE = 120 * dpr;

  // 초기 위치 설정
  let x = (position.screenWidth - width) / 2;
  let y = (position.screenHeight - height) / 2;

  // width = 200;
  // height = 200;
  // scale = 4;
  // x=0;
  // y=0;

  position.setScale(scale);
  position.setWidth(Math.floor(width));
  position.setHeight(Math.floor(height));
  position.setX(Math.floor(x));
  position.setY(Math.floor(y));
}

export function setMagification(new_scale, anchor_point) {
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
  let px = p.x;
  let py = p.y;

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
  let px = canvasX;
  let py = canvasY;
  return { x: px, y: py };
}

export function canvas_coord_to_css_coord({ x, y }) {
  const screen = canvas_coord_to_screen_coord(x, y);
  const world = to_world_coord(screen.x, screen.y);
  return world;
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px =
    ((x - position.bouncingRect.x) / position.scale) * getPixelRatio() -
    position.x;
  let py =
    ((y - position.bouncingRect.y) / position.scale) * getPixelRatio() -
    position.y;
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
  position.setX(position.x + x);
  position.setY(position.y + y);

  position.setWidth(newWidth);
  position.setHeight(newHeight);

  const worker = getLayerWorker();

  worker.resizeLayer(x, y, newWidth, newHeight);
  //renderChangedPosition();
}

let dpr;
export function getPixelRatio() {
  if (!dpr) {
    dpr = window.devicePixelRatio;
  }
  return dpr;
}
import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection" | "resize"; // 선택창 풀면 brush로 됌
type BrushId = "brush" | "eraser" | "liquify";
class PaintState {
    action: Action = "BRUSH";
    toolId: ToolId = "brush";
    brushId: BrushId = "brush";
    brushSize = { brush: 5, eraser: 10, liquify: 50 };
    brushAlpha = { brush: 100, eraser: 100, liquify: 100 };

    cursorX = 0;
    cursorY = 0;

    pointerdown = false;
    drawing = false;

    targetId = "brush";

    changed = false;
    showCircle = false;
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
    setDrawing(val: boolean) {
        this.drawing = val;
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
    moved = true;

    setMoved(value) {
        this.moved = value;
    }
    
}

export const paintState = new PaintState();
import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { toolManager } from "./draw";
import { paintState } from "./paintState";
import { selection } from "./selection";

class HistoryState {
  undoCount = 0;
  redoCount = 0;

  constructor() {
    makeAutoObservable(this);
  }
  getUndoCount() {
    return this.undoCount;
  }
  getRedoCount() {
    return this.redoCount;
  }

  setUndoCount(count) {
    this.undoCount = count;
  }
  setRedoCount(count) {
    this.redoCount = count;
  }
}

export const historyState = new HistoryState();

export async function undo() {
  if (paintState.pointerdown) return;

  if (paintState.toolId == "resize") {
    toolManager.setBrushTool();
  }

  let worker = getLayerWorker();
  let msg = await worker.undo();
  if (!msg) return;
  console.warn("change tool:", msg);
  if (msg == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (msg == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
  } else if (msg == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (msg == "liquify") {
    // 이때 liquify -> brush로 가면 liquify의 exit안해도 됌.

    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", msg);
  }
}

export async function redo() {
  if (paintState.pointerdown) return;

  if (paintState.toolId == "resize") {
    toolManager.setBrushTool();
  }
  let worker = getLayerWorker();
  let msg = await worker.redo();
  if (!msg) return;
  console.warn("change tool:", msg);
  if (msg == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (msg == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
  } else if (msg == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (msg == "liquify") {
    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", msg);
  }
}
/** file.ts */
import { els } from "./ui/elements";
import { getLayerWorker } from "./worker/workerPool";
//import { encode } from "fast-png";
import { encode } from "@jsquash/png";
import * as Comlink from "comlink";
import {
  applySelection,
  cutSelection,
  makeSelectionFromBitmap,
  selection,
} from "./selection";
import {
  getPixelRatio,
  position,
  renderChangedPosition,
  setCameraPosition,
  setDefaultPosition,
} from "./position";
import { paintState } from "./paintState";
import { toolManager } from "./draw";

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
    for (const file of Array.from(dt.files)) {
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

  // 붙여넣기
  window.addEventListener("paste", async (event: ClipboardEvent) => {
    const target = event.target;
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    console.log(target);
    if (isInput) return; // 인풋창이면 기본 이벤트 허용
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

    for (const item of Array.from(items)) {
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
    const target = event.target;
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    console.log(target);
    if (isInput) return; // 인풋창이면 기본 이벤트 허용
    event.preventDefault();
    if (selection.visible) {
      let worker = getLayerWorker();
      worker.copy();
    }
  });

  // 잘라내기 = 복사와 동일, 나중에 cut 전용 로직 넣어도 됨
  window.addEventListener("cut", (event: ClipboardEvent) => {
    const target = event.target;
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    console.log(target);
    if (isInput) return; // 인풋창이면 기본 이벤트 허용
    event.preventDefault();
    if (selection.visible) {
      let worker = getLayerWorker();
      worker.cut();
    }

    cutSelection();
  });
}

function uploadImage(bitmap: ImageBitmap) {
  toolManager.setBrushTool();

  console.log("uploadImage", position.bouncingRect.width, bitmap.width);
  let val = 1.125;
  let xScale = position.screenWidth / (bitmap.width * val);
  let yScale = position.screenHeight / (bitmap.height * val);
  let scale = Math.min(xScale, yScale);

  let x = (position.screenWidth - bitmap.width * scale) / 2 / scale;
  let y = (position.screenHeight - bitmap.height * scale) / 2 / scale;

  position.setScale(scale);
  position.setX(x);
  position.setY(y);
  position.setWidth(bitmap.width);
  position.setHeight(bitmap.height);

  const worker = getLayerWorker();
  worker.uploadImage(Comlink.transfer(bitmap, [bitmap]));

  renderChangedPosition();
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

async function selectFileChrome(): Promise<File> {
  if (!window.showOpenFilePicker) {
    console.warn("이 브라우저는 showOpenFilePicker를 지원하지 않습니다.");
    return await selectFile();
  }

  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: "Images",
        accept: {
          "image/*": [".png", ".jpg", ".jpeg", ".webp", ".bmp"],
        },
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  });

  const file = await handle.getFile();
  return file;
}

function selectFile(accept = "image/*"): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("파일이 선택되지 않았습니다."));
      }
      document.body.removeChild(input);
    });

    document.body.appendChild(input);
    input.click();
  });
}

export async function openFile() {
  try {
    const file = await selectFileChrome(); // 파일 선택
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "flipY",
      premultiplyAlpha: "premultiply",
    });
    uploadImage(bitmap);
  } catch (err) {
    console.error("파일 열기 실패:", err);
  }
}

export function resetImage() {
  toolManager.setBrushTool();

  setDefaultPosition();
  const worker = getLayerWorker();
  worker.resetImage(position.width, position.height);
  renderChangedPosition();
}

export async function downloadPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const imageData = new ImageData(pixels, width, height);

  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = await encode(imageData);

  // 2. Blob 생성
  const blob = new Blob([pngData], { type: "image/png" });

  // 3. 다운로드 링크 생성
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "image.png"; // 다운로드할 파일 이름 지정

  // 4. 링크 클릭하여 다운로드 실행
  link.click();

  // 5. Blob URL 해제
  URL.revokeObjectURL(url);

  console.log("파일 다운로드 완료!!");
}

export function downloadImage() {
  let worker = getLayerWorker();
  worker.downloadImage();
}
/** draw.ts */
import { paintState } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { position } from "./position";

export const toolManager = {
  async setBrushTool() {
    if (paintState.pointerdown) return;
    paintState.setToolId("brush");
    paintState.setBrushId("brush");

    const worker = getLayerWorker();
    applySelection();
    worker.setTool(paintState.brushId);

    console.log("brush");
  },
  setEraserTool() {
    if (paintState.pointerdown) return;
    paintState.setToolId("brush");
    paintState.setBrushId("eraser");

    const worker = getLayerWorker();
    applySelection();
    worker.setTool(paintState.brushId);
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;
    paintState.setToolId("brush");
    paintState.setBrushId("liquify");

    const worker = getLayerWorker();
    applySelection();
    worker.setTool(paintState.brushId);
  },
  setSelectTool() {
    if (paintState.pointerdown) return;
    applySelection();
    paintState.setToolId("select");

    const worker = getLayerWorker();
    worker.setTool("select");
  },
  setSelection() {
    if (paintState.pointerdown) return;
    paintState.setToolId("selection");

    const worker = getLayerWorker();
    worker.setTool("selection");
  },
  setResizeTool() {
    if (paintState.pointerdown) return;

    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId);

    applySelection();
    selection.setWidth(position.width);
    selection.setHeight(position.height);
    selection.setX(0);
    selection.setY(0);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    paintState.setToolId("resize");
  },
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
  console.log("cancel!");

  if (paintState.toolId == "selection") {
    selectionCancel();
    return;
  }

  dispatch(new PointerEvent("pointercancel"), "cancel");
}
import { makeAutoObservable } from "mobx";

class ColorState {
  h = 150;
  s = 0;
  v = 0;

  inputText = "";

  constructor() {
    makeAutoObservable(this);
    this.onChangeColor();
  }

  getRGB() {
    const rgb = hsvToRgb(this.h, this.s, this.v);
    return rgb;
  }
  setColorFromRGB(r: number, g: number, b: number) {
    let { h, s, v } = rgbToHsv(r, g, b);
    this.h = h;
    this.s = s;
    this.v = v;
    this.onChangeColor();
  }
  setColorFromHex(hexStr) {
    let rgb = hexToRGB(hexStr);
    if (!rgb) {
      return;
    }
    let { r, g, b } = rgb;
    let { h, s, v } = rgbToHsv(r, g, b);
    this.h = h;
    this.s = s;
    this.v = v;
    this.onChangeColor();
  }
  onChangeColor() {
    const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
    this.inputText = rgbToHex(r, g, b);
  }

  setH(h) {
    this.h = h;
    this.onChangeColor();
  }
  getH() {
    return this.h;
  }
  setS(s) {
    this.s = s;
    this.onChangeColor();
  }
  getS() {
    return this.s;
  }
  setV(v) {
    this.v = v;
    this.onChangeColor();
  }
  getV() {
    return this.v;
  }

  setInputText(text) {
    this.inputText = text;
  }
  getInputText() {
    return this.inputText;
  }
  autoComplete(): string {
    // 1. 앞뒤 공백 제거, 맨 앞 # 제거, 공백 내부 제거
    let s = this.inputText.trim().replace(/^#/, "").replace(/\s+/g, "");
    // 2. 대문자로 변환하고, 0-9/A-F 외 문자 제거
    s = s.toUpperCase().replace(/[^0-9A-F]/g, "");

    // 3. 길이에 따라 처리
    if (s.length >= 6) {
      // 6자리 이상 → 앞 6자리만
      return s.slice(0, 6);
    }
    if (s.length === 0) {
      const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
      return rgbToHex(r, g, b);
    }
    if (s.length === 1) {
      // 1자리 → 6번 반복
      return s.repeat(6);
    }
    if (s.length === 2) {
      // 2자리 → 3번 반복
      return s.repeat(3);
    }
    // 길이 3,4,5 → 앞 3글자 가져와서 each char를 2번씩 반복
    const triplet = s.slice(0, 3);
    let hexStr = triplet
      .split("")
      .map((c) => c + c)
      .join("");

    let rgb = hexToRGB(hexStr);
    if (!rgb) {
      console.warn("hex validation 실패");
      const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
      return rgbToHex(r, g, b);
    }

    return hexStr;
  }
}

export const colorState = new ColorState();

function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  // 1. 정규화 (0~255 → 0~1)
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  // 2. max, min, delta 계산
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  // 3. Hue 계산
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else if (max === bn) {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  // 4. Saturation 계산
  const s = max === 0 ? 0 : delta / max;

  // 5. Value 계산
  const v = max;

  return { h, s, v };
}

function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const c = v * s; // chroma: 색의 강도
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); // 보조 색
  const m = v - c; // 밝기 조정용

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else if (h >= 300 && h <= 360) {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return { r, g, b };
}

export function rgbToCss(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}
export function HsvToCss(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return `rgb(${r}, ${g}, ${b})`;
}
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16).toUpperCase();
    return hex.length === 1 ? "0" + hex : hex;
  };

  return toHex(r) + toHex(g) + toHex(b);
}

function hexToRGB(hex: string): { r: number; g: number; b: number } | null {
  // 1. 전처리: #이 앞에 붙어있으면 제거
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }

  // 2. 형식 검증: 정확히 6자리 16진수인지 확인
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  // 3. 파싱
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return { r, g, b };
}
// 웹워커 쓰레드 js 파일
import * as Comlink from "comlink";
import { workerApi } from "./paintController";

console.log("worker!");

Comlink.expose(workerApi);
/// <reference lib="webworker" />

import {
  BrushTool,
  EraserTool,
  installTools,
  LiquifyTool,
} from "../gl/tool/tool";
import { paintOptions } from "../gl/texture";
import { getRenderingManager } from "../gl/render";
import { resizeLayer, resizeScreen } from "../gl/resize";
import { getSelectionManager } from "../gl/selection";
import { getLayerManager } from "../gl/layer";
import { getCanvasPixelManager, resetImage, uploadImage } from "../gl/file";
import { getHistoryManager } from "../gl/history/history";
import { mainThread } from "./mainPool";
import { Callink } from "callink";

interface Pointer {
  x: number;
  y: number;
}

export class PaintService {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;

  tools: any;
  lastPointer: Pointer;

  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    let gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.gl = gl;
    paintOptions.toolId = "brush";

    this.init();
  }
  async init() {
    await this.installTools();

    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();

    console.log("Making Layer Complete!");
  }

  async installTools() {
    await installTools(this.canvas, this.gl);

    let brushTool = new BrushTool(this.canvas, this.gl);
    let eraserTool = new EraserTool(this.canvas, this.gl);
    let liquifyTool = new LiquifyTool(this.canvas, this.gl);

    this.tools = {
      brush: brushTool,
      eraser: eraserTool,
      liquify: liquifyTool,
    };
  }

  setCameraPosition(x, y, magnification) {
    paintOptions.x = x;
    paintOptions.y = y;
    paintOptions.magnification = magnification;
  }
  resizeLayer(x, y, width, height) {
    resizeLayer(this.canvas, this.gl, x, y, width, height);
  }
  resizeScreen(screenWidth, screenHeight) {
    resizeScreen(this.canvas, this.gl, screenWidth, screenHeight);
  }
  render() {
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }
  setLayerId(layerId) {
    // 레이어 바꾸기 전에 무조건 툴, 선택창 종료하기!
    this.getTool().exit();
    this.getTool().enter();

    let layerManager = getLayerManager(this.canvas, this.gl);
    layerManager.setLayerId(layerId);
  }

  setStrokeColor(r, g, b) {
    paintOptions.setColor({ r, g, b });
  }

  setStrokeSize(strokeSize) {
    let radius = strokeSize / 2; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    paintOptions.setRadius(radius);
  }

  setAlpha(alpha) {
    paintOptions.setAlpha(alpha);
  }
  setTool(toolId, doExit) {
    if (paintOptions.toolId != toolId && doExit) {
      this.getTool()?.exit();
      paintOptions.toolId = toolId;
      this.getTool()?.enter();
    }
    paintOptions.toolId = toolId;
    if (toolId == "select") return;
  }
  getTool() {
    return this.tools[paintOptions.toolId];
  }
  start(pointer: Pointer) {
    this.getTool().start(pointer);
    this.lastPointer = pointer;
  }
  strokeTo(pointer: Pointer) {
    this.getTool().stroke(this.lastPointer, pointer);
    this.lastPointer = pointer;
  }
  end() {
    this.getTool().end();
  }
  cancel() {
    this.getTool().cancel();
  }
  select(x, y, width, height) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.select(x, y, width, height);
  }
  endMove() {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.endMove();
  }
  moveSelection(x, y, width, height) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.setSize(x, y, width, height);
  }
  applySelection() {
    if (paintOptions.showSelection) {
      let selectionManager = getSelectionManager(this.canvas, this.gl);
      selectionManager.applySelection();
    }
  }
  paste(x, y, width, height, imageBitmap) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.paste(x, y, width, height, imageBitmap);
  }
  copy() {
    // 선택 된 이미지를 다운로드 해서 클립보드로 저장.
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    mainThread.copy(Callink.transfer(pixels, [pixels.buffer]), width, height);
  }
  cut() {
    // 선택 된 이미지를 다운로드 해서 클립보드로 저장.
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    selectionManager.afterCut();
    mainThread.copy(Callink.transfer(pixels, [pixels.buffer]), width, height);
  }
  selectionDelete() {
    paintOptions.showSelection = false;
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }
  uploadImage(imageBitmap: ImageBitmap) {
    uploadImage(this.canvas, this.gl, imageBitmap);
  }
  resetImage(width, height) {
    resetImage(this.canvas, this.gl, width, height);
  }
  async downloadImage() {
    let manager = getCanvasPixelManager(this.canvas, this.gl);
    let { pixels, width, height } = manager.getCanvasPixelData();
    await mainThread.download(
      Callink.transfer(pixels, [pixels.buffer]),
      width,
      height,
    );
  }

  undo() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.undo();
  }
  redo() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.redo();
  }
}
import { paintOptions } from "../gl/texture";
import { PaintService } from "./paintService";

let paint: PaintService;

export const workerApi = {
  async makeLayer(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    px: number,
    py: number,
    scale: number,
  ) {
    let { x, y } = toWebglCoord3(
      px,
      py,
      width,
      height,
      screenWidth,
      screenHeight,
      scale,
    );

    paintOptions.screenWidth = screenWidth;
    paintOptions.screenHeight = screenHeight;
    paintOptions.dpr = dpr;
    paintOptions.width = width;
    paintOptions.height = height;

    paintOptions.x = x;
    paintOptions.y = y;

    paintOptions.magnification = scale;

    main_canvas.width = screenWidth;
    main_canvas.height = screenHeight;

    paint = new PaintService(main_canvas);
  },
  setLayerId(layerId) {
    paint.setLayerId(layerId);
  },
  setCamaraPosition(px, py, magnification) {
    let { x, y } = toWebglCoord3(
      px,
      py,
      paintOptions.width,
      paintOptions.height,
      paintOptions.screenWidth,
      paintOptions.screenHeight,
      magnification,
    );
    paint.setCameraPosition(x, y, magnification);
  },
  resizeLayer(px, py, width, height) {
    const diffH = paintOptions.height - height;
    let newY;

    if (py !== 0) {
      newY = 0;
    } else {
      newY = py + diffH;
    }
    paint.resizeLayer(px, newY, width, height);
  },
  resizeScreenSize(screenWidth, screenHeight) {
    paint.resizeScreen(screenWidth, screenHeight);
  },
  render() {
    paint.render();
  },
  setStrokeColor(r, g, b) {
    paint.setStrokeColor(r, g, b);
  },
  setStrokeSize(size) {
    paint.setStrokeSize(size);
  },
  setAlpha(alpha) {
    paint.setAlpha(alpha / 100);
  },
  setTool(toolId, doExit = true) {
    paint.setTool(toolId, doExit);
  },
  start(p: Pointer) {
    let pointer = toWebglCoord(p);
    paint.start(pointer);
  },
  strokeTo(p: Pointer) {
    let pointer = toWebglCoord(p);
    paint.strokeTo(pointer);
  },
  end() {
    paint.end();
  },
  cancel() {
    paint.cancel();
  },
  select(px, py, w, h) {
    let { x, y } = toWebglCoord2(px, py, w, h);
    paint.select(x, y, w, h);
  },
  endMove() {
    paint.endMove();
  },
  moveSelection(px, py, width, height) {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.moveSelection(x, y, width, height);
  },
  applySelection() {
    paint.applySelection();
  },
  paste(px, py, width, height, imageBitmap) {
    let { x, y } = toWebglCoord2(px, py, width, height);
    paint.paste(x, y, width, height, imageBitmap);
  },
  copy() {
    paint.copy();
  },
  cut() {
    paint.cut();
  },
  selectionDelete() {
    paint.selectionDelete();
  },
  uploadImage(bitmap) {
    paint.uploadImage(bitmap);
  },
  resetImage(width, height) {
    paint.resetImage(width, height);
  },
  downloadImage() {
    paint.downloadImage();
  },
  undo() {
    return paint.undo();
  },
  redo() {
    return paint.redo();
  },
};

interface Pointer {
  x: number;
  y: number;
}

function toWebglCoord(pointer) {
  let { x, y } = pointer;
  return {
    x,
    y: paintOptions.height - y,
  };
}

function toWebglCoord2(x, y, w, h) {
  return {
    x,
    y: paintOptions.height - y - h,
    w,
    h,
  };
}

function toWebglCoord3(x, y, width, height, screenWidth, screenHeight, scale) {
  let newY = -y + screenHeight / scale - height;
  return {
    x,
    y: newY,
  };
}
import { Callink } from "callink";
import { mainApi } from "@/app/worker/mainController";

type MainApi = typeof mainApi;

export const mainThread = Callink.connect<MainApi>();
import { getManager } from "./utils/cachedManager";
import { createShader } from "./utils/glHelper";

/**
 * in vec2 a_position;
 */
export function getFullQuadShader(gl) {
  const manager = getManager(gl, "fullQuadVertexShader", () =>
    makeFullQuadVertexShader(gl),
  );
  return manager;
}

function makeFullQuadVertexShader(gl) {
  let vertexShaderSource = `#version 300 es
  in vec2 a_position;
  out vec2 v_texCoord; // 좌표변환: 0 ~ 1

  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
  `;

  let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  return vertexShader;
}

export function getBufferManager(canvas, gl) {
  const manager = getManager(gl, "bufferManager", () => makeBufferManager(gl));
  return manager;
}

function makeBufferManager(gl) {
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  function createFullQuadVAO(program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, "a_position");

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return vao;
  }

  return {
    createFullQuadVAO,
  };
}
import { getLayerManager } from "./layer";
import { getManager } from "./utils/cachedManager";
import { getRenderingManager } from "./render";
import { getHistoryManager, HistoryItem } from "./history/history";
import { DirtyRect } from "./utils/dirtyRect";
import {
  pushReadPixelQueue,
  setDrawingFlag,
} from "./history/pixelReadProcessor";
import { PixelReader } from "./history/PixelReader";
import { Snapshot } from "./tool/liquify";
export const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, 셰이더에서 접근 X!)
  LAYER: 1, // 그림을 그릴 대상
  SOURCE: 2, // 원본 이미지 (Source Image)
  PATHMAP: 3, // 브러시, 지우개 알파맵
  DISPLACEMENT: 5, // 변위맵 (Displacement Map)
  SOURCE_DISPLACEMENT: 6, // 변위맵 이전 상태 저장 용

  SOURCE_SELECTION: 9, // 선택창 확대/축소시 대상으로 사용할 텍스쳐
  RENDERED_SELECTION: 10, // 선택창 확대/축소, copy시 그릴 버퍼
  OFFSCREEN: 11, // 렌더링 전 미리 그릴 버퍼

  EASE_INTEGRAL: 17, // Ease In-Out Cubic Integral
  EASE_MIRROR: 18, // Ease In-Out Cubic Mirror
};

// W, H, cW, cH, sW, sH, mW, mH

// 최대값: W=H=cW=cH=sW=sH=mW=mH=4096
// (in-out) = 2  // read용 draw용 총 두개가 있다는 뜻

// 레이어 (1개): W * H * (RGBA) => 64MB
// SOURCE: W * H * (RGBA) => 64MB
// PATHMAP: W * H * (RED) * (in‑out) => 32MB
// DISPLACEMENT: W * H * (half‑float) * (in‑out) => 64MB (dynamic)
// SOURCE_DISPLACEMENT: W * H * (half‑float) => 32MB (dynamic)
// SOURCE_SELECTION: sW * sH * (RGBA) => 64MB (dynamic)
// RENDERED_SELECTION: mW * mH * (RGBA) => 64MB (dynamic)
// OFFSCREEN: cW * cH * (RGBA) => 7.91MB ~ 64MB

// dynamic 텍스쳐 설정하면 168 ~ 296

// 레이어 한층: 64
// SOURCE: 64
// draw = 32
// liquify: 64 + 32 = 96 (dynamic)
// selection: 64 + 64 = 128 (dynamic)

// 각각 레이어 원본은 DRAM에 들고있다가 타겟 레이어가 변경되면
// 그때 버퍼에 올리기로 하자.


// 일반 브러시는 pointerup하면 소스 텍스쳐에 반영 전에 히스토리 스택에 소스 텍스쳐를 업로드 한다.
// 픽셀유동화는 pointerup 하면 SOURCE_DISPLACEMENT에 반영 전에 히스토리 스택에 SOURCE_DISPLACEMENT를 업로드 한다.

// 픽셀유동화를 나가는것도 스택에 넣는데, 이땐 displace 전체와 source 전체를 업로드 한다. (유동화 생명주기 전체에서 dirtyRect도 구하기)

// 일반 브러시를 나가는것도 스택에....

export let paintOptions = {
  width: 100,
  height: 100,
  dpr: 1,
  radius: 10,
  color: [0, 0, 0],
  alpha: 0.5,
  x: 0,
  y: 0,
  magnification: 1,

  screenWidth: 800,
  screenHeight: 800,

  showSelection: false,
  selectionAntialias: true,
  layerId: 0,
  selectionLayerId: 0,

  toolId: "brush",

  setAlpha(newAlpha) {
    paintOptions.alpha = newAlpha;
  },

  setRadius(newRadius) {
    paintOptions.radius = newRadius;
  },

  setColor({ r, g, b }) {
    paintOptions.color[0] = r / 255;
    paintOptions.color[1] = g / 255;
    paintOptions.color[2] = b / 255;
  },
};

/**
 * 소스 텍스쳐는 텍스처 슬롯 1번을 차지하고 있습니다.
 */

export function getSourceTextureManager(canvas, gl) {
  const manager = getManager(gl, "sourceTexture", () =>
    makeSourceTextureManager(canvas, gl),
  );
  return manager;
}

function makeSourceTextureManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);

  const sourceTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.width,
    paintOptions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let sourceFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sourceFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    sourceTexture,
    0,
  );

  function applyHistory(layerId, pixelReader, rect) {
    // console.log(history)
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerManager.getLayerTex(layerId));

    // pixelData를 texture에 다시 업로드
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0, // level
      rect.x, // x 좌표
      rect.y, // y 좌표
      rect.width, // width
      rect.height, // height
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      pixelReader.getPixelData(), // 데이터
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFBO);

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );
  }

  const fbo = gl.createFramebuffer();

  function makeDirtyTexture(pathDirty) {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      pathDirty.width,
      pathDirty.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여 화면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0,
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      0,
      0,
      pathDirty.width,
      pathDirty.height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }
  function getCurrentSnapshot(x, y, width, height) {
    const renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    const beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, beforePixelReader);

    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.layerId, this.pixelReader, this.rect);
      },
    };
    return beforeSnapshot;
  }

  function upload(x, y, width, height) {
    const renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    const beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, beforePixelReader);

    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.layerId, this.pixelReader, this.rect);
      },
    };

    // sourceMap으로 업로드
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFBO);

    gl.blitFramebuffer(
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    const afterTex = makeDirtyTexture(renderRect);
    const afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, afterPixelReader);

    const afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.layerId, this.pixelReader, this.rect);
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  // 캔버스를 소스 텍스쳐로 돌려놓기
  function restore() {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, layerManager.layerFBO);

    gl.blitFramebuffer(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function setSize() {
    //console.warn("source 크기 조정");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  setSize();
  upload(0, 0, paintOptions.width, paintOptions.height);

  let sourceTextureManager = {
    texture: sourceTexture,
    upload,
    restore,
    sourceFBO,
    setSize,
    getCurrentSnapshot,
  };

  return sourceTextureManager;
}
import { paintConfig } from "@/paint.config";
import { mainThread } from "../worker/mainPool";
import { getHistoryManager, HistoryItem } from "./history/history";
import { PixelReader } from "./history/PixelReader";
import { pushReadPixelQueue } from "./history/pixelReadProcessor";
import { getLayerManager } from "./layer";
import { getRenderingManager } from "./render";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { HistoryObject, Snapshot } from "./tool/liquify";
import { getManager } from "./utils/cachedManager";
import { DirtyRect, Rect } from "./utils/dirtyRect";
import { decodePremultAndFlip } from "./utils/flipPixel";
import { createProgram, createShader } from "./utils/glHelper";
import { getBufferManager, getFullQuadShader } from "./vertexShader";

export function getSelectionManager(canvas, gl) {
  const manager = getManager(gl, "selection", () =>
    createSelectionManager(canvas, gl),
  );
  return manager;
}

function createSelectionManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);

  let selectionPos = {
    x: 0,
    y: 0,
    width: 9,
    height: 9,
  };
  // let selectionPos.x = 0;
  // let selectionPos.y = 0;
  // let selectionPos.width = 10;
  // let selectionPos.height = 10;

  let originalWidth;
  let originalHeight;

  // 텍스처 생성
  const selectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, selectionTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // 무엇이 나을까
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const renderedSelectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let selectionShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_selection_source;
    uniform sampler2D u_selection;
    uniform sampler2D u_source;

    uniform vec2 u_resolution;      // 실제 캔버스 크기 (px)

    uniform vec2 u_selectionPos;    // 선택 영역 위치 (캔버스 내부 기준)
    uniform vec2 u_selectionSize;   // 선택 영역 크기

    in vec2 v_texCoord;             // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;

    void main() {
      vec2 scaledScreenSize = u_resolution;

      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      vec2 size = u_selectionSize;

      // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 selectionPos = vec2(u_selectionPos.x, u_selectionPos.y);
      vec2 minPos = selectionPos;
      vec2 maxPos = selectionPos + size;

      // 현재 픽셀이 selection 안에 있지 않으면 버림
      if (
        scaledFragCoord.x < minPos.x || scaledFragCoord.x > maxPos.x ||
        scaledFragCoord.y < minPos.y || scaledFragCoord.y > maxPos.y
      ) {
        discard;
      }

      // 선택영역 내에 있으면 텍스처 좌표 계산
      vec2 local = (scaledFragCoord - minPos) / size;
      vec4 selectionColor;
      
      if(u_selectionSize.x > 2048.0 || u_selectionSize.y > 2048.0){
        // 화면이 엄청 크면 걍 근사로
        selectionColor = texture(u_selection_source, local);    // 프리
      } else {
        vec2 newLocal = local * size / ${paintConfig.maxSize}.0;
        selectionColor = texture(u_selection, newLocal);    // 프리
      }
      
      vec4 imageColor = texture(u_source, v_texCoord);      // 프리
      
      float srcA = selectionColor.a;
      float dstA = imageColor.a;
      
      float outA = srcA + dstA * (1.0 - srcA);
      vec3 outRGB = selectionColor.rgb + imageColor.rgb * (1.0 - srcA);
      
      outColor = vec4(outRGB, outA);
    }
  `;
  const fullQuadVertexShader = getFullQuadShader(gl);
  let selectionShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    selectionShaderSource,
  );
  let selectionProgram = createProgram(
    gl,
    fullQuadVertexShader,
    selectionShader,
  );
  gl.useProgram(selectionProgram);

  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection_source"),
    TEXTURE_UNIT.SOURCE_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  );

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(selectionProgram);

  const selectionFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);
  gl.framebufferTexture2D(
    gl.READ_FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    selectionTex,
    0,
  );

  const renderedSelectionFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderedSelectionFBO);
  gl.framebufferTexture2D(
    gl.DRAW_FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    renderedSelectionTex,
    0,
  );

  function openTexture() {
    //console.log("openTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);

    // 선택창 크기 변경은 자주 일어나므로, 텍스쳐 크기를 매번 변경하기 힘들다. 그래서 미리 늘려놓는다.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintConfig.maxSize,
      paintConfig.maxSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  function closeTexture() {
    //console.log("closeTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, selectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      1, // 텍스처 폭
      1, // 텍스처 높이
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  // 늘린 텍스쳐에 늘려서 복사하기
  function uploadRenderedTex(force = false) {
    if (selectionPos.width <= 2048.0 && selectionPos.height <= 2048.0) {
    } else if (force) {
    } else {
      return;
    }

    // console.log("selection render!");

    // 원본 텍스처가 붙을 FBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);
    // 크기 늘린 텍스처가 붙을 FBO
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderedSelectionFBO);

    // GPU를 이용해 텍스처 크기 조정 (원본 → 늘어난 크기)
    gl.blitFramebuffer(
      0,
      0,
      originalWidth,
      originalHeight, // 원본 영역
      0,
      0,
      selectionPos.width,
      selectionPos.height, // 목표 영역 (크기 조정됨)
      gl.COLOR_BUFFER_BIT,
      paintOptions.selectionAntialias ? gl.LINEAR : gl.NEAREST,
    );
  }

  const fbo = gl.createFramebuffer();

  function makeSelectionCopyTexture() {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      originalWidth,
      originalHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여 화면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0,
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      0,
      0,
      originalWidth,
      originalHeight,
      0,
      0,
      originalWidth,
      originalHeight, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  function selectionSnapshot() {
    const renderRect = Rect.fromWidth(0, 0, originalWidth, originalHeight);

    const selectionCopyTex = makeSelectionCopyTexture();

    let pixelReader = new PixelReader(
      gl,
      originalWidth,
      originalHeight,
      selectionCopyTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, pixelReader);
    const selectionPosRect = Rect.fromWidth(
      selectionPos.x,
      selectionPos.y,
      selectionPos.width,
      selectionPos.height,
    );

    let showSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: pixelReader,
      rect: renderRect,
      selectionRect: selectionPosRect,
      apply() {
        openTexture();
        selectionPos.x = this.selectionRect.x;
        selectionPos.y = this.selectionRect.y;
        selectionPos.width = this.selectionRect.width;
        selectionPos.height = this.selectionRect.height;
        originalWidth = this.rect.width;
        originalHeight = this.rect.height;

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
        gl.bindTexture(gl.TEXTURE_2D, selectionTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0, // level
          gl.RGBA, // internalFormat
          originalWidth, // 텍스처 폭
          originalHeight, // 텍스처 높이
          0, // border
          gl.RGBA, // format
          gl.UNSIGNED_BYTE, // type
          this.pixelReader.getPixelData(),
        );

        paintOptions.showSelection = true;
      },
    };

    let hideSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      rect: renderRect,
      apply() {
        // 선택창 제거
        paintOptions.showSelection = false;
        closeTexture();
      },
    };

    return {
      show: showSnapshot,
      hide: hideSnapshot,
    };
  }

  function select(sx, sy, swidth, sheight) {
    openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = false;

    selectionPos.x = sx;
    selectionPos.y = sy;
    selectionPos.width = swidth;
    selectionPos.height = sheight;
    originalWidth = swidth;
    originalHeight = sheight;
    beforePos = structuredClone(selectionPos);

    // 1) select texture 크기 조절
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, selectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      originalWidth, // 텍= �처 폭
      originalHeight, // 텍스처 높이
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      null,
    );

    // 2) selection Tex에 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, selectionFBO);

    gl.blitFramebuffer(
      selectionPos.x,
      selectionPos.y,
      selectionPos.x + originalWidth,
      selectionPos.y + originalHeight, // src 영역
      0,
      0,
      originalWidth,
      originalHeight, // dst 영역
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼 (컬러 버퍼)
      gl.NEAREST, // 필터링 모드 (스케일링 없이 복사)
    );

    // 3) 선택된 영역을 완전히 투명으로 지우기
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(sx, sy, swidth, sheight);

    gl.clearColor(0, 0, 0, 0); // RGBA 모두 0
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.SCISSOR_TEST);

    let { show: after, hide: before } = selectionSnapshot();

    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(sx, sy, swidth, sheight);

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "select";
      },
      redo: () => {
        after.apply();
        afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    uploadRenderedTex();
  }

  function applySelection() {
    paintOptions.showSelection = false;

    gl.useProgram(selectionProgram);
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionPos"),
      selectionPos.x,
      selectionPos.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      selectionPos.width,
      selectionPos.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let { show: before, hide: after } = selectionSnapshot();

    // sourceTextureManager rect는 꼭 캔버스 내부 영역으로 제한
    let dirty = DirtyRect.copy(selectionPos);
    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(dirty.x, dirty.y, dirty.width, dirty.height);

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
      redo: () => {
        after.apply();
        afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "brush";
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    closeTexture();

    renderingManager.render();
  }

  // makeSelection, clearLayer -> drawLayer -> applySelection
  function paste(newx, newy, newwidth, newheight, bitmap: ImageBitmap) {
    openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = true;

    selectionPos.x = newx;
    selectionPos.y = newy;
    selectionPos.width = newwidth;
    selectionPos.height = newheight;
    originalWidth = newwidth;
    originalHeight = newheight;
    beforePos = structuredClone(selectionPos);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // mip level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      bitmap, // ✅ 직접 전달 가능
    );

    uploadRenderedTex();

    let { hide: before, show: after } = selectionSnapshot();

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "select";
      },
      redo: () => {
        after.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    renderingManager.render();
  }

  function getPixelData() {
    // 픽셀 읽기 준비 (뒤집힌 픽셀)
    const flippedPixel = new Uint8Array(
      selectionPos.width * selectionPos.height * 4,
    );

    console.log("getPixelData", selectionPos.width, selectionPos.height);
    if (selectionPos.width > 2048.0 || selectionPos.height > 2048.0) {
      uploadRenderedTex(true); // 이게 readpixel하려면 어쨌든 텍스쳐에 써야함...
    }

    // 픽셀 읽기
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderedSelectionFBO);
    gl.readPixels(
      0,
      0,
      selectionPos.width,
      selectionPos.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      flippedPixel,
    );

    // 최종 픽셀 (논프멀, 위에서 아래로 플립됨)
    const pixels = decodePremultAndFlip(
      flippedPixel,
      selectionPos.width,
      selectionPos.height,
    );

    return { pixels, width: selectionPos.width, height: selectionPos.height };
  }

  function afterCut() {
    paintOptions.showSelection = false;
    renderingManager.render();
  }

  let beforePos;

  function endMove() {
    let historyManager = getHistoryManager(canvas, gl);
    let beforePosition = structuredClone(beforePos);
    let afterPosition = structuredClone(selectionPos);

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        setSize(
          beforePosition.x,
          beforePosition.y,
          beforePosition.width,
          beforePosition.height,
        );

        beforePos = structuredClone(selectionPos);

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
      redo: () => {
        setSize(
          afterPosition.x,
          afterPosition.y,
          afterPosition.width,
          afterPosition.height,
        );

        beforePos = structuredClone(selectionPos);
        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
    });

    beforePos = structuredClone(selectionPos);

    historyManager.addUndo(newHistory);
  }

  function setSize(newX, newY, newWidth, newHeight) {
    selectionPos.x = newX;
    selectionPos.y = newY;

    if (selectionPos.width != newWidth || selectionPos.height != newHeight) {
      console.log("selection size:", newWidth, newHeight);
      // 텍스쳐 크기 재조정.
      // 텍스쳐는 선택 원본 텍스쳐, 선택 렌더링용 텍스쳐 두개를 분리해야하고.
      // 화면에 보여줄 때는 렌더셀렉트을 보여주고, 리드픽셀 할때도 렌더셀렉트를 읽어야한다.
      // 원본 선택 텍스는 오직 크기 변경시 렌더셀렉트를 구현하기 위해 존재한다.
      // 선택 이미지가 바뀌었을 때도 소스셀렉트를 먼저 그것으로 바꾸고, 렌더셀렉트를 렌더링 해야한다.

      selectionPos.width = newWidth;
      selectionPos.height = newHeight;

      uploadRenderedTex();
    }

    renderingManager.render();
  }

  function getPosition() {
    return {
      x: selectionPos.x,
      y: selectionPos.y,
      width: selectionPos.width,
      height: selectionPos.height,
    };
  }

  return {
    texture: selectionTex,
    getPosition,
    setSize: setSize,
    applySelection,
    select,
    paste,
    getPixelData,
    afterCut,
    endMove,
  };
}
import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getLayerManager } from "./layer";
import { getLiquifyManager, HistoryObject, Snapshot } from "./tool/liquify";
import { getBrushManager } from "./tool/brushTool";
import { getManager } from "./utils/cachedManager";
import { getOffscreenManager, getRenderingManager } from "./render";
import { PixelReader } from "./history/PixelReader";
import { pushReadPixelQueue } from "./history/pixelReadProcessor";
import { DirtyRect } from "./utils/dirtyRect";
import { getHistoryManager } from "./history/history";
import { mainThread } from "../worker/mainPool";

/**
 * 도화지의 크기를 조절함
 */
export function resizeLayer(canvas, gl, x, y, width, height) {
  const resizeTexManager = getResizeLayerTexManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const drawManager = getBrushManager(canvas, gl);
  const liquifyManager = getLiquifyManager(canvas, gl);
  console.log("resizeLayer");

  let oldWidth = paintOptions.width;
  let oldHeight = paintOptions.height;
  let newWidth = width;
  let newHeight = height;

  // 현재 그림은 그대로 둔 상태로 크기만 바꾸기
  const snapshots = resizeTexManager.preserveAndResize(
    x,
    y,
    oldWidth,
    oldHeight,
    width,
    height,
  );

  let before = sourceTextureManager.getCurrentSnapshot(
    0,
    0,
    paintOptions.width,
    paintOptions.height,
  );

  paintOptions.x += x;
  paintOptions.y += y;
  paintOptions.width = width;
  paintOptions.height = height;

  function setToolSize() {
    sourceTextureManager.setSize();
    if (!drawManager || !liquifyManager) {
      console.error("지금 도구가 다운되기 전에 사이즈 변경이 일어남!");
    } else {
      drawManager.setSize();
      liquifyManager.setSize();
    }
  }

  setToolSize();

  let { after } = sourceTextureManager.upload(
    0,
    0,
    paintOptions.width,
    paintOptions.height,
  );
  const renderingManager = getRenderingManager(canvas, gl);
  renderingManager.render();

  const newHistory = new HistoryObject(gl, {
    undo: () => {
      paintOptions.x -= x;
      paintOptions.y -= y;
      paintOptions.width = oldWidth;
      paintOptions.height = oldHeight;

      setToolSize();

      for (let snapshot of snapshots) {
        snapshot.before.apply();
      }
      before.apply();

      renderingManager.render();

      mainThread.setPosition(
        paintOptions.x,
        paintOptions.y,
        paintOptions.width,
        paintOptions.height,
      );
      return "brush";
    },
    redo: () => {
      paintOptions.x += x;
      paintOptions.y += y;
      paintOptions.width = newWidth;
      paintOptions.height = newHeight;

      setToolSize();

      for (let snapshot of snapshots) {
        snapshot.after.apply();
      }
      after.apply();

      renderingManager.render();

      mainThread.setPosition(
        paintOptions.x,
        paintOptions.y,
        paintOptions.width,
        paintOptions.height,
      );
      return "brush";
    },
  });

  let historyManager = getHistoryManager(canvas, gl);
  historyManager.addUndo(newHistory);
}

// 화면의 크기를 조절함
export function resizeScreen(canvas, gl, screenWidth, screenHeight) {
  const offscreenManager = getOffscreenManager(canvas, gl);

  console.log("resizeScreen");

  // canvas Element의 크기를 변경
  canvas.width = screenWidth;
  canvas.height = screenHeight;

  paintOptions.screenWidth = screenWidth;
  paintOptions.screenHeight = screenHeight;
  offscreenManager.resize(screenWidth, screenHeight);
}

function getResizeLayerTexManager(canvas, gl) {
  const manager = getManager(gl, "resizeTex", () =>
    createResizeManager(canvas, gl),
  );
  return manager;
}

function createResizeManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);

  // 1. 임시 텍스처 생성

  const tempTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, tempTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const tempFBO = gl.createFramebuffer();
  const mainFBO = gl.createFramebuffer();

  const readfbo = gl.createFramebuffer();
  const drawfbo = gl.createFramebuffer();

  function copyTexture(layerTex, width, height) {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여 화면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readfbo);
    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      layerTex,
      0,
    );

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawfbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0,
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      0,
      0,
      width,
      height,
      0,
      0,
      width,
      height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  function resize(
    x,
    y,
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
    layerTex,
  ) {
    console.log("resize", oldWidth, oldHeight, newWidth, newHeight);

    let beforeTex = copyTexture(layerTex, oldWidth, oldHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, mainFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      layerTex,
      0,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tempTex,
      0,
    );

    // temp에 임시 저장
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mainFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, tempFBO);

    gl.blitFramebuffer(
      0,
      0,
      oldWidth,
      oldHeight,
      0,
      0,
      oldWidth,
      oldHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    // 대상 텍스쳐 늘리기
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, layerTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      newWidth,
      newHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    // 임시 텍스처 → 레이어 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tempFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, mainFBO);

    gl.blitFramebuffer(
      x,
      y,
      x + newWidth,
      y + newHeight, // 원본 영역
      0,
      0,
      newWidth,
      newHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    let afterTex = copyTexture(layerTex, newWidth, newHeight);

    const beforePixelReader = new PixelReader(
      gl,
      oldWidth,
      oldHeight,
      beforeTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, beforePixelReader);

    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: DirtyRect.fromWidth(0, 0, oldWidth, oldHeight),
      apply() {
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
        gl.bindTexture(gl.TEXTURE_2D, layerTex);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0, // level
          gl.RGBA, // internalFormat
          this.rect.width,
          this.rect.height,
          0, // border
          gl.RGBA, // format
          gl.UNSIGNED_BYTE, // type
          this.pixelReader.getPixelData(),
        );
      },
    };

    const afterPixelReader = new PixelReader(
      gl,
      newWidth,
      newHeight,
      afterTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, afterPixelReader);

    const afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: DirtyRect.fromWidth(0, 0, newWidth, newHeight),
      apply() {
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
        gl.bindTexture(gl.TEXTURE_2D, layerTex);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0, // level
          gl.RGBA, // internalFormat
          this.rect.width,
          this.rect.height,
          0, // border
          gl.RGBA, // format
          gl.UNSIGNED_BYTE, // type
          this.pixelReader.getPixelData(),
        );
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  function resizeAll(
    x,
    y,
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
  ) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, tempTex);
    // temp 크기 설정
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      oldWidth,
      oldHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    let snapshots = [];
    for (let layerTex of layerManager.layerArray) {
      let snapshot = resize(
        x,
        y,
        oldWidth,
        oldHeight,
        newWidth,
        newHeight,
        layerTex,
      );
      snapshots.push(snapshot);
    }

    layerManager.bindCurrentLayer();

    return snapshots;
  }

  return {
    preserveAndResize: resizeAll,
  };
}
import { TEXTURE_UNIT, paintOptions } from "./texture";
import { getLayerManager } from "./layer";

import { getSelectionManager } from "./selection";

import { createShader, createProgram } from "./utils/glHelper";
import { getBufferManager, getFullQuadShader } from "./vertexShader";
import { getManager } from "./utils/cachedManager";
import { Rect } from "./utils/dirtyRect";
import { paintConfig } from "@/paint.config";

export function getRenderingManager(canvas, gl) {
  const manager = getManager(gl, "rendering", () =>
    makeRenderingManager(canvas, gl),
  );
  return manager;
}

function makeRenderingManager(canvas, gl) {
  const fullQuadVertexShader = getFullQuadShader(gl);
  const offscreenManager = getOffscreenManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  let displaySource = `#version 300 es
      precision highp float;
    
      in vec2 v_texCoord;
      out vec4 outColor;
    
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_screenSize;
      uniform float u_magnification;
      uniform float u_dpr;
    
    
    void main() {
      // 실제 픽셀 좌표
      float px = v_texCoord.x * u_screenSize.x / u_dpr ;
      float py = v_texCoord.y * u_screenSize.y / u_dpr ;
    
      float cellSize = 16.0 ;   // 셀 크기
      float borderSize = 1.0;  // 테두리 두께
    
      float modX = mod(px, cellSize);
      float modY = mod(py, cellSize);
    
      // 경계선 근처면 밝은 선 색
      if (modX < borderSize || modY < borderSize) {
        outColor = vec4(0.89, 0.89, 0.89, 1.0);  // 테두리
      } else {
        outColor = vec4(0.91, 0.91, 0.91, 1.0);  // 셀 내부 
      }
    }
  `;

  let displayShader = createShader(gl, gl.FRAGMENT_SHADER, displaySource);
  let displayProgram = createProgram(gl, fullQuadVertexShader, displayShader);
  gl.useProgram(displayProgram);

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(displayProgram);

  function renderDisplay() {
    gl.useProgram(displayProgram);

    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(displayProgram, "u_magnification"),
      paintOptions.magnification,
    );
    gl.uniform1f(
      gl.getUniformLocation(displayProgram, "u_dpr"),
      paintOptions.dpr,
    );

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let backgroundSource = `#version 300 es
    precision highp float;
    
    in vec2 v_texCoord;
    out vec4 outColor;
    
    uniform vec2 u_resolution;   // 캔버스(원본 텍스처) 해상도 (px)
    uniform vec2 u_pos;          // 캔버스의 왼쪽 상단 위치 (2D UI 좌표, px)
    uniform vec2 u_screenSize;   // 전체 스크린 크기 (px)
    uniform float u_magnification; // 확대 배율 (값이 클수록 크게 보임)

    void main() {
      // 1. magnification을 반영한 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 canvasSize = u_resolution;
      
      // 2. 풀스크린 정규 좌표(v_texCoord)를 스케일된 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      
      // 3. 2D UI 기준 (왼쪽 상단 기준)인 캔버스 영역을 스케일된 좌표계로 변환  
      vec2 canvasPos = vec2(u_pos.x, u_pos.y);
      vec2 minCanvPos = canvasPos;
      vec2 maxCanvPos = canvasPos + canvasSize;
      
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 체크
      if (scaledFragCoord.x < minCanvPos.x ||
          scaledFragCoord.x > maxCanvPos.x ||
          scaledFragCoord.y < minCanvPos.y ||
          scaledFragCoord.y > maxCanvPos.y) {
        discard;
      }
      
      // 5. 캔버스 영역 내부라면, 지정한 배경색을 출력  
      vec3 rgb = vec3(0.0, 0.0, 0.0);
      float alpha = 0.04;
      //outColor = vec4(rgb * alpha, alpha);
       
      outColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  let backgroundShader = createShader(gl, gl.FRAGMENT_SHADER, backgroundSource);
  let backgroundProgram = createProgram(
    gl,
    fullQuadVertexShader,
    backgroundShader,
  );
  gl.useProgram(backgroundProgram);
  bufferManager.createFullQuadVAO(backgroundProgram);

  function renderBackground() {
    gl.useProgram(backgroundProgram);

    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(backgroundProgram, "u_magnification"),
      paintOptions.magnification,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let renderShaderSource = `#version 300 es
    precision highp float;
    
    uniform sampler2D u_source;   // 원본 텍스처
    
    uniform vec2 u_resolution;    // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)
    uniform vec2 u_pos;           // 전체 스크린 크기 (픽셀 단위)
    uniform vec2 u_screenSize;    // 확대 배율 (값이 클수록 크게 보임)
    uniform float u_magnification;
    
    in vec2 v_texCoord;           // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;
    
    void main() {
      // 1. magnification 반영된 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 canvasSize = u_resolution;
      
      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
     
      // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 canvasPos = vec2(u_pos.x, u_pos.y);
      vec2 minCanvPos = canvasPos;
      vec2 maxCanvPos = canvasPos + canvasSize;
    
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
      if (scaledFragCoord.x < minCanvPos.x ||
          scaledFragCoord.x > maxCanvPos.x ||
          scaledFragCoord.y < minCanvPos.y ||
          scaledFragCoord.y > maxCanvPos.y) {
        discard;
      }
    
      // 5.) 캔버스 영역 내의 상대 좌표 (0~1) 계산
      vec2 local = (scaledFragCoord - minCanvPos) / canvasSize;
    
      // 6. 원본 텍스처에서 local 좌표로 색상을 샘플링
      vec4 imageColor = texture(u_source, local);
      outColor = vec4(imageColor.rgb, imageColor.a);
    }
  `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderShaderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_source"),
    TEXTURE_UNIT.LAYER,
  );
  bufferManager.createFullQuadVAO(renderProgram);

  function renderTexture() {
    gl.useProgram(renderProgram);

    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(renderProgram, "u_magnification"),
      paintOptions.magnification,
    );

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * 격자무늬 렌더링
   */

  let gridShaderSource = `#version 300 es
    precision highp float;

    uniform vec2 u_resolution;    // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)
    uniform vec2 u_pos;           // 전체 스크린 크기 (픽셀 단위)
    uniform vec2 u_screenSize;    // 확대 배율 (값이 클수록 크게 보임)
    uniform float u_magnification;
    uniform float u_dpr;
    
    in vec2 v_texCoord;           // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;

    void main() {
      // 1. magnification 반영된 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 canvasSize = u_resolution;

      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;

      // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 canvasPos = vec2(u_pos.x, u_pos.y);
      vec2 minCanvPos = canvasPos;
      vec2 maxCanvPos = canvasPos + canvasSize;

      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
      if (scaledFragCoord.x < minCanvPos.x ||
          scaledFragCoord.x > maxCanvPos.x ||
          scaledFragCoord.y < minCanvPos.y ||
          scaledFragCoord.y > maxCanvPos.y) {
        discard;
      }

      vec2 screenPx = v_texCoord * u_screenSize;

      
      float pixelStep   = u_magnification * u_dpr;  // device‑pixel 단위
   
      // 현재 프래그먼트의 캔버스 내 위치를 *스크린 픽셀* 단위로 환산
      // scaledFragCoord는 (스크린픽셀 / u_magnification) 단위이므로
      // 다시 u_magnification·u_dpr을 곱해주면 실제 스크린‑픽셀 좌표가 된다.
      vec2 canvasPx = (scaledFragCoord - minCanvPos) * u_magnification * u_dpr;

      float gridX = fract(canvasPx.x / pixelStep + 0.005);
      float gridY = fract(canvasPx.y / pixelStep + 0.005);
      
      // 임계값: 선 두께가 전체 격자 간격에서 차지하는 비율
      float threshold = 1.0 / u_magnification;
      
      bool isGridLine = gridX <= threshold || gridY <= threshold;

      // 격자 색상(시안)으로 덮어쓰기
      if (isGridLine) {
        vec3 rgb = vec3(1.0,1.0,1.0);
        float alpha = 0.2;
        outColor = vec4(rgb * alpha, alpha);
      }
      
    }
  `;

  let gridShader = createShader(gl, gl.FRAGMENT_SHADER, gridShaderSource);
  let gridProgram = createProgram(gl, fullQuadVertexShader, gridShader);
  gl.useProgram(gridProgram);
  bufferManager.createFullQuadVAO(gridProgram);

  function renderGrid() {
    if (paintOptions.magnification / paintOptions.dpr > 20) {
      gl.useProgram(gridProgram);

      gl.uniform2f(
        gl.getUniformLocation(gridProgram, "u_resolution"),
        paintOptions.width,
        paintOptions.height,
      );
      gl.uniform2f(
        gl.getUniformLocation(gridProgram, "u_pos"),
        paintOptions.x,
        paintOptions.y,
      );
      gl.uniform2f(
        gl.getUniformLocation(gridProgram, "u_screenSize"),
        paintOptions.screenWidth,
        paintOptions.screenHeight,
      );
      gl.uniform1f(
        gl.getUniformLocation(gridProgram, "u_magnification"),
        paintOptions.magnification,
      );
      gl.uniform1f(
        gl.getUniformLocation(gridProgram, "u_dpr"),
        paintOptions.dpr,
      );

      // 쓰기 영역: 캔버스
      gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
      gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  /**
   * 선택창 렌더링
   */

  let selectionShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_selection_source;
    uniform sampler2D u_selection;
    
    uniform vec2 u_pos;             // 전체 화면 기준: 캔버스 왼쪽 상단
    uniform vec2 u_resolution;      // 실제 캔버스 크기 (px)
    uniform vec2 u_screenSize;      // 전체 스크린 크기 (px)
    uniform float u_magnification;
    
    uniform vec2 u_selectionPos;    // 선택 영역 위치 (캔버스 내부 기준)
    uniform vec2 u_selectionSize;   // 선택 영역 크기
    
    in vec2 v_texCoord;             // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;
    
    void main() {
      // 1. magnification 반영된 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 canvasSize = u_resolution;
  
      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      
      
      // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 selectionPos = vec2(u_pos.x + u_selectionPos.x, u_pos.y + u_selectionPos.y);
      vec2 minSelPos = selectionPos;
      vec2 maxSelPos = selectionPos + u_selectionSize;
    
      // 현재 픽셀이 selection 안에 있지 않으면 버림
      if (
        scaledFragCoord.x < minSelPos.x || scaledFragCoord.x > maxSelPos.x ||
        scaledFragCoord.y < minSelPos.y || scaledFragCoord.y > maxSelPos.y
      ) {
        discard;
      }

      // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 canvasPos = vec2(u_pos.x, u_pos.y);
      vec2 minCanvPos = canvasPos;
      vec2 maxCanvPos = canvasPos + canvasSize;
      bool isOut = false;

      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
      if (scaledFragCoord.x < minCanvPos.x ||
          scaledFragCoord.x > maxCanvPos.x ||
          scaledFragCoord.y < minCanvPos.y ||
          scaledFragCoord.y > maxCanvPos.y) {
        isOut = true;
      }
    
      // 선택영역 내에 있으면 텍스처 좌표 계산
      vec2 local = (scaledFragCoord - minSelPos) / u_selectionSize;

      if(u_selectionSize.x > 2048.0 || u_selectionSize.y > 2048.0){
        // 화면이 엄청 크면 걍 근사로
        vec4 imageColor = texture(u_selection_source, local);
        if (isOut){
          float alpha = 0.25;
          outColor = vec4(imageColor.rgb * alpha, imageColor.a * alpha);
          return;
        }
        outColor = vec4(imageColor.rgb, imageColor.a);
        return;
      } 

      // 이제 변환을 해야하는데, 현재 100px너비에서의 0.5 라면 50px인데, 이걸 8192텍스쳐 기준으로 잡으면
      vec2 newLocal = local * u_selectionSize / ${paintConfig.maxSize}.0;
      vec4 imageColor = texture(u_selection, newLocal);
      if (isOut){
        float alpha = 0.25;
        outColor = vec4(imageColor.rgb * alpha, imageColor.a * alpha);
        return;
      }
      outColor = vec4(imageColor.rgb, imageColor.a);
    }
  `;

  let selectionShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    selectionShaderSource,
  );
  let selectionProgram = createProgram(
    gl,
    fullQuadVertexShader,
    selectionShader,
  );
  gl.useProgram(selectionProgram);

  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection_source"),
    TEXTURE_UNIT.SOURCE_SELECTION,
  );
  // I want... => selectionProgram.setUniform1i("u_selection", TEXTURE_UNIT.SELECTION);
  bufferManager.createFullQuadVAO(selectionProgram);

  function renderSelection() {
    let selectionManager = getSelectionManager(canvas, gl);
    let selectionPos = selectionManager.getPosition();
    gl.useProgram(selectionProgram);

    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(selectionProgram, "u_magnification"),
      paintOptions.magnification,
    );

    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionPos"),
      selectionPos.x,
      selectionPos.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      selectionPos.width,
      selectionPos.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderNow(rect: Rect) {
    getSelectionManager(canvas, gl);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    if (paintOptions.selectionAntialias) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    gl.scissor(rect.x, rect.y, rect.width, rect.height);

    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    renderDisplay();

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.BLEND);

    renderBackground();

    // 레이어 전부 그리기
    for (let i = 0; i < layerManager.layerArray.length; i++) {
      let layerTex = layerManager.layerArray[i];
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
      gl.bindTexture(gl.TEXTURE_2D, layerTex);
      renderTexture();
      if (paintOptions.showSelection && i == paintOptions.layerId) {
        renderSelection();
      }
    }
    layerManager.bindCurrentLayer();

    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR);

    renderGrid();

    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    gl.flush();

    // null 프레임버퍼에 전송하기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.blitFramebuffer(
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // src rect
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // dst rect
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR,
    );

    // gl.blitFramebuffer(
    //   rect.x,
    //   rect.y,
    //   rect.width,
    //   rect.height,
    //   rect.x,
    //   rect.y,
    //   rect.width,
    //   rect.height,
    //   gl.COLOR_BUFFER_BIT,
    //   gl.NEAREST,
    // );

    console.log("render complete!");
  }

  let scheduled = false;

  function render(rect = undefined) {
    //console.log("rect:", rect);
    let newRect: Rect;

    if (rect) {
      let calX = Math.floor(rect.x + paintOptions.x);
      let calY = Math.floor(rect.y + paintOptions.y);
      let calW = Math.ceil(rect.width * paintOptions.magnification);
      let calH = Math.ceil(rect.height * paintOptions.magnification);
      //console.log("x:", rect.x, paintOptions.magnification, paintOptions.x);
      //console.log("calculated:", calX, calY, calW, calH);
      newRect = Rect.fromWidth(calX, calY, calW, calH);
    } else {
      newRect = Rect.fromWidth(
        0,
        0,
        paintOptions.screenWidth,
        paintOptions.screenHeight,
      );
    }

    // if (!scheduled) {
    // scheduled = true;
    // requestAnimationFrame(() => {
    //  scheduled = false;
    renderNow(newRect);
    // });
    //}
  }
  return {
    render,
  };
}

export function getOffscreenManager(canvas, gl) {
  const manager = getManager(gl, "offscreen", () =>
    createOffscreenManager(canvas, gl),
  );
  return manager;
}
function createOffscreenManager(canvas, gl) {
  const offscreenTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
  gl.bindTexture(gl.TEXTURE_2D, offscreenTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.screenWidth,
    paintOptions.screenHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const offscreenFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    offscreenTex,
    0,
  );

  function resize(newWidth, newHeight) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
    // temp 크기 설정
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      newWidth,
      newHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  return {
    resize,
    offscreenFBO,
  };
}
import { getManager } from "./utils/cachedManager";
import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getRenderingManager } from "./render";

export function getLayerManager(canvas, gl) {
  const manager = getManager(gl, "layer", () => makeLayerManager(canvas, gl));
  return manager;
}

function makeLayerManager(canvas, gl) {
  let layerTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex);

  // 축소 되었을 떄는 리니어 보간
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.width,
    paintOptions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  let layerFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    layerTex,
    0,
  );
  layerTex.id = 0;

  let layerTex2 = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex2);

  // 축소 되었을 떄는 리니어 보간
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.width,
    paintOptions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  layerTex2.id = 1;

  // 처음 레이어 ㄱㄱ
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex);

  // 레이어 모음 구현
  let layerArray = [layerTex, layerTex2];

  function setLayerId(newLayerId) {
    paintOptions.layerId = newLayerId;
    let currentLayerTex = layerArray[paintOptions.layerId];

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, currentLayerTex);
    console.log("setLayerId:", currentLayerTex.id);
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      currentLayerTex,
      0,
    );

    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    sourceTextureManager.upload(0, 0, paintOptions.width, paintOptions.height);
    const renderingManager = getRenderingManager(canvas, gl);
    renderingManager.render();
  }

  function bindCurrentLayer() {
    let currentLayerTex = layerArray[paintOptions.layerId];

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, currentLayerTex);
    //console.log("현재 bindCurrentLayer:", paintOptions.layerId);
  }

  function getLayerTex(layerId) {
    if (layerId == 1) {
      return layerTex2;
    }
    return layerTex;
  }

  function addLayer(newLayerId) {
    let newLayerTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerTex);

    // 축소 되었을 떄는 리니어 보간
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }
  return {
    layerFBO,
    setLayerId,
    layerArray,
    bindCurrentLayer,
    getLayerTex,
  };
}
import { resetHisory } from "./history/history";
import { getLayerManager } from "./layer";
import { getRenderingManager } from "./render";
import { resizeLayer } from "./resize";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { getBrushManager } from "./tool/brushTool";
import { getLiquifyManager } from "./tool/liquify";
import { getManager } from "./utils/cachedManager";
import { decodePremultAndFlip } from "./utils/flipPixel";
import { createProgram, createShader } from "./utils/glHelper";
import { getBufferManager, getFullQuadShader } from "./vertexShader";

export function uploadImage(canvas, gl, bitmap: ImageBitmap) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(
    canvas,
    gl,
    paintOptions.x,
    paintOptions.y,
    bitmap.width,
    bitmap.height,
  );

  resetHisory();
  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    bitmap, // ✅ 직접 전달 가능
  );

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTextureManager.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

  sourceTextureManager.upload(0, 0, paintOptions.width, paintOptions.height);

  // 알파맵, 변위맵, 선택창 초기화하기!

  if (paintOptions.toolId != "brush") {
    console.error("브러시일때만 새로운 파일 열기!");
  }

  renderingManager.render();
}

export function resetImage(canvas, gl, width, height) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(canvas, gl, paintOptions.x, paintOptions.y, width, height);

  resetHisory();
  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width, // ✅ 반드시 필요
    height, // ✅ 반드시 필요
    0, // border (항상 0)
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    null, // → allocate only
  );

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTextureManager.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width, // ✅ 반드시 필요
    height, // ✅ 반드시 필요
    0, // border (항상 0)
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    null, // → allocate only
  );

  renderingManager.render();
}

export function getCanvasPixelManager(canvas, gl) {
  const manager = getManager(gl, "canvasPixel", () =>
    canvasPixelManager(canvas, gl),
  );
  return manager;
}

function canvasPixelManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);

  const canvasTex = gl.createTexture();
  const canvasFBO = gl.createFramebuffer();

  const renderSource = `#version 300 es
    precision mediump float;

    uniform sampler2D u_source;   // 원본 텍스처
    
    uniform vec2 u_resolution;    // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)

    in vec2 v_texCoord;           // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;

    void main() {
     outColor = texture(u_source, v_texCoord);
    }
  `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(renderProgram);

  function renderTexture() {
    gl.useProgram(renderProgram);

    gl.uniform1i(
      gl.getUniformLocation(renderProgram, "u_source"),
      TEXTURE_UNIT.LAYER,
    );

    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, canvasFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function getCanvasPixelData() {
    // 크기 재설정
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, canvasTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, canvasFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      canvasTex,
      0,
    );

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    // canvasFBO에 layers 순서대로 드로우콜
    for (let i = 0; i < layerManager.layerArray.length; i++) {
      let layerTex = layerManager.layerArray[i];
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
      gl.bindTexture(gl.TEXTURE_2D, layerTex);
      renderTexture();
    }
    // 그리기 완료
    layerManager.bindCurrentLayer();

    gl.disable(gl.BLEND);

    // 픽셀 읽기 시작
    const width = paintOptions.width;
    const height = paintOptions.height;

    // FBO에 그려진 결과를 읽어오기
    const pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let flip = decodePremultAndFlip(pixels, width, height);
    return { pixels: flip, width, height };
  }

  return {
    getCanvasPixelData,
  };
}
// 메인스레드 임포트 영역
import * as Comlink from "comlink";
import { workerApi } from "@/core/worker/paintController";
import WorkerModule from "@/core/worker/worker?worker";
import { mainApi } from "./mainController";
import { Callink } from "callink";

type WorkerApi = typeof workerApi;

interface WorkerPool {
  [key: string]: {
    worker: Worker;
    workerApi: Comlink.Remote<WorkerApi>;
  };
}
const workerPool: WorkerPool = {};

function getWorkerObject() {
  if (!workerPool["layer"]) {
    const worker = new WorkerModule();

    // 워커 수신
    Callink.provide(worker, mainApi);

    // worker 사용
    const api = Comlink.wrap<WorkerApi>(worker);

    // main 쓰레드 사용
    // const api = workerApi;

    workerPool["layer"] = { worker, workerApi: api };
  }
  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().workerApi;
}
import { copyPixelsToClipboard, downloadPixels } from "../file";
import { historyState } from "../history";
import { paintState } from "../paintState";
import { getPixelRatio, position } from "../position";
import { selection } from "../selection";
import { getLayerWorker } from "./workerPool";

export const mainApi = {
  historyCount(undoCount, redoCount) {
    historyState.setUndoCount(undoCount);
    historyState.setRedoCount(redoCount);
  },
  copy(pixels, width, height) {
    let pixelData: Uint8ClampedArray = pixels;
    copyPixelsToClipboard(pixelData, width, height);
  },
  download(pixels, width, height) {
    let pixelData: Uint8ClampedArray = pixels;
    downloadPixels(pixelData, width, height);
  },
  setSelectionPosition(showSelection, x, y, width, height) {
    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(showSelection);
    selection.setShowHint(showSelection);
    selection.setVisible(showSelection);
    let worker = getLayerWorker();

    if (showSelection) {
      paintState.setToolId("selection");
      worker.setTool("selection");
    } else {
      paintState.setToolId("select");
      worker.setTool("select");
    }
  },
  setPosition(x, y, width, height) {
    let newY = position.screenHeight / position.scale - height - y;

    position.setX(x);
    position.setY(newY);
    position.setWidth(width);
    position.setHeight(height);
  },
};
// utils/selectionHitTest.ts
import { getPixelRatio, position } from "../position";

export type HandleType =
  | "LT"
  | "T"
  | "RT"
  | "L"
  | "INSIDE"
  | "R"
  | "LB"
  | "B"
  | "RB"
  | "OUTSIDE";

/**
 * 선택창·핸들 히트테스트
 * @param clientX  화면 기준 X
 * @param clientY  화면 기준 Y
 * @param selRect  { x, y, width, height }  // canvas 공간 기준
 * @param margin   핸들 margin (22px)
 */
export function getSelectionHandleAtPoint(
  clientX: number,
  clientY: number,
  selRect: { x: number; y: number; width: number; height: number },
  margin = 22,
): HandleType {
  const dpr = getPixelRatio();

  /** ───── ① canvas 좌표 → 화면 좌표 변환 */
  const toScreen = (canvasX: number, canvasY: number) => ({
    x: ((canvasX + position.x) * position.scale) / dpr,
    y:
      ((canvasY + position.y) * position.scale) / dpr +
      position.bouncingRect.y - // 상단 AppBar
      position.bottomNavHeight, // 하단 NavBar
  });

  const { x: cX, y: cY, width: cW, height: cH } = selRect;
  const p = toScreen(cX, cY);
  const w = (cW * position.scale) / dpr;
  const h = (cH * position.scale) / dpr;

  const left = p.x;
  const right = p.x + w;
  const top = p.y;
  const bottom = p.y + h;

  const m = margin;

  const inRect = (
    x: number,
    y: number,
    r: { x: number; y: number; w: number; h: number },
  ) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  // ───── 꼭짓점 44×44
  const corners = {
    LT: { x: left - m, y: top - m, w: m * 2, h: m * 2 },
    RT: { x: right - m, y: top - m, w: m * 2, h: m * 2 },
    RB: { x: right - m, y: bottom - m, w: m * 2, h: m * 2 },
    LB: { x: left - m, y: bottom - m, w: m * 2, h: m * 2 },
  } as const;

  // ───── 모서리 (두께 44, 길이는 선택창 길이)
  const edges = {
    T: { x: left, y: top - m, w: w, h: m * 2 },
    R: { x: right - m, y: top, w: m * 2, h: h },
    B: { x: left, y: bottom - m, w: w, h: m * 2 },
    L: { x: left - m, y: top, w: m * 2, h: h },
  } as const;

  // ───── 우선순위: 꼭짓점 → 모서리 → 내부
  for (const k of ["LT", "RT", "RB", "LB"] as const)
    if (
      inRect(clientX, clientY, {
        ...corners[k],
        w: corners[k].w,
        h: corners[k].h,
      })
    )
      return k;

  for (const k of ["T", "R", "B", "L"] as const)
    if (inRect(clientX, clientY, { ...edges[k], w: edges[k].w, h: edges[k].h }))
      return k;

  if (
    inRect(clientX, clientY, {
      x: left + m,
      y: top + m,
      w: w - m * 2,
      h: h - m * 2,
    })
  )
    return "INSIDE";

  return "OUTSIDE";
}
export function isSmallSize() {
  return window.innerWidth < 800;
}
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function hexToRgb(hex) {
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

export function rgbToHex({ r, g, b }) {
    const toHex = (v) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// zoomState.ts
import { makeAutoObservable } from "mobx";

export class ZoomRectState {
    sx = 0;
    sy = 0;
    ex = 0;
    ey = 0;

    constructor() {
        makeAutoObservable(this);
    }

    setStart(x: number, y: number) {
        this.sx = this.ex = x;
        this.sy = this.ey = y;
    }

    updateEnd(x: number, y: number) {
        this.ex = x;
        this.ey = y;
    }

    reset() {
        this.sx = this.sy = this.ex = this.ey = 0;
    }
}

export const zoomRect = new ZoomRectState();
/** view.ts */
import { paintState } from "../paintState";
import { autorun } from "mobx";
import { els } from "./elements";
import { selection } from "../selection";
import { getPixelRatio, position, to_canvas_coord } from "../position";
import { zoomRect } from "./zoomState";
import { isSmallSize } from "../utils/screen";

export function bindView() {
  bindCursorUI();
  bindSelectionUI();
  bindCursorPositionUI();
  bindZoomAreaUI();
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
  autorun(() => {
    const isSelectionTool =
      (paintState.action === "BRUSH" && paintState.toolId === "selection") ||
      paintState.toolId === "resize";
    container.classList.toggle(
      "nwse-resize",
      isSelectionTool && selection.hover == "nwse-resize",
    );
    container.classList.toggle(
      "nesw-resize",
      isSelectionTool && selection.hover == "nesw-resize",
    );
    container.classList.toggle(
      "ns-resize",
      isSelectionTool && selection.hover == "ns-resize",
    );
    container.classList.toggle(
      "ew-resize",
      isSelectionTool && selection.hover == "ew-resize",
    );
    container.classList.toggle(
      "move",
      isSelectionTool && selection.hover == "move",
    );
  });

  autorun(() => {
    const cursor = els.brushCursor;

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
    container.classList.toggle("brush", isValid && !showCircle && !isBigSize);
    container.classList.toggle("noCursor", isValid && showCircle);

    // ───────────── 브러시 커서 스타일
    if ((isValid && (isBigSize || showCircle)) || !isDesktop) {
      if (isDesktop || paintState.drawing) {
        cursor.style.visibility = "visible";
      } else {
        cursor.style.visibility = "hidden";
      }
      if (!isDesktop && paintState.pointerdown && paintState.moved) {
        cursor.style.visibility =
          (paintState.getBrushSize() * position.scale) / getPixelRatio() > 16
            ? "visible"
            : "hidden";
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
    const visible = selection.showHint;

    els.selectionArea.style.visibility = visible ? "visible" : "hidden";
    els.selectionSizeBox.style.visibility = visible ? "visible" : "hidden";

    const dpr = getPixelRatio();
    const scaledLeft = ((selection.x + position.x) * position.scale) / dpr;
    const scaledTop = ((selection.y + position.y) * position.scale) / dpr;
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
    const visible = selection.showHandle;
    const dpr = getPixelRatio();
    let sLeft = ((selection.x + position.x) * position.scale) / dpr;
    let sTop = ((selection.y + position.y) * position.scale) / dpr;
    let sWidth = (selection.width * position.scale) / dpr;
    let sHeight = (selection.height * position.scale) / dpr;

    // 핸들 표시/숨김
    const handles = [els.handleLT, els.handleRT, els.handleRB, els.handleLB];

    for (const h of handles) {
      h.style.visibility = visible ? "visible" : "hidden";
    }

    // 위치 계산
    const offset = 3;
    const setPos = (handle: HTMLElement, left: number, top: number) => {
      handle.style.left = `${left - offset}px`;
      handle.style.top = `${top - offset}px`;
    };

    if (visible) {
      setPos(els.handleLT, sLeft, sTop);
      setPos(els.handleRT, sLeft + sWidth, sTop);
      setPos(els.handleRB, sLeft + sWidth, sTop + sHeight);
      setPos(els.handleLB, sLeft, sTop + sHeight);
    }
  });
}

function bindCursorPositionUI() {
  autorun(() => {
    let point = to_canvas_coord(paintState.cursorX, paintState.cursorY);
    let x = Math.ceil(point.x);
    let y = Math.ceil(point.y);
    let visible = 0 < x && x <= position.width && 0 < y && y <= position.height;

    els.positionBox.style.visibility = visible ? "visible" : "hidden";
    //els.positionBox.style.visibility = "hidden";
    els.positionText.innerText = `${x} x ${y}`;
  });
}

function bindZoomAreaUI() {
  autorun(() => {
    const isZooming = paintState.action === "ZOOM";

    if (!isZooming) {
      els.zoomArea.style.visibility = "hidden";
      return;
    }

    const startX = Math.min(zoomRect.sx, zoomRect.ex);
    const startY = Math.min(zoomRect.sy, zoomRect.ey);
    const width = Math.abs(zoomRect.sx - zoomRect.ex);
    const height = Math.abs(zoomRect.sy - zoomRect.ey);

    els.zoomArea.style.visibility = "visible";
    els.zoomArea.style.left = `${startX}px`;
    els.zoomArea.style.top = `${startY}px`;
    els.zoomArea.style.width = `${width}px`;
    els.zoomArea.style.height = `${height}px`;
  });
}
import { makeAutoObservable } from "mobx";

class MenuState {
    showMenu = false;
    showColorMenu = false;

    // 모바일
    showSizeBar = false;
    showTools = true;

    constructor() {
        makeAutoObservable(this);
    }

    setShowMenu(value) {
        this.showMenu = value;
    }
    setShowColorMenu(value) {
        this.showColorMenu = value;
    }
    setShowTools(value) {
        this.showTools = value;
    }
    setShowSizeBar(value) {
        this.showSizeBar = value;
    }

    closeAllMenu() {
        this.showMenu = false;
    }
}

export const menuState = new MenuState();
/** elements.ts */
import CursorSvg from "../assets/cursor.svg?raw";

function $id<T extends HTMLElement = HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (element) {
    return element as T;
  }
  throw new Error(`No element found with id "${elementId}"`);
}

type Elements = ReturnType<typeof elements>;

export let els: Elements = elements();

function elements() {
  return {
    canvas: $id<HTMLCanvasElement>("canvas")!,
    container: $id("container"),
    brushCursor: $id("brush-cursor"),
    zoomArea: $id("zoom-area"),

    selectionArea: $id("selection-area"),
    handleLT: $id("handle-lt"),
    handleRT: $id("handle-rt"),
    handleRB: $id("handle-rb"),
    handleLB: $id("handle-lb"),

    selectionSizeBox: $id("selection-size"),
    selectionText: $id("selection-text"),

    positionBox: $id("cursor-position"),
    positionText: $id("cursor-position-text"),
  };
}

export function getElements() {
  els = elements();
  $id("cursor-icon").innerHTML = CursorSvg;
}
/** clickEvent.ts */
import { paintState } from "../paintState";
import { toolManager } from "../draw";
import { els } from "./elements";

export function addClickEvent() {

    // 커서 위치 이벤트
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

    document.addEventListener(
        "gesturestart",
        (e) => {
            e.preventDefault(); // Safari 방지
        },
        { passive: false },
    );
    //
    els.container.addEventListener(
        "touchstart",
        (e) => {
            // prevent swipe to navigate gesture
            e.preventDefault();
        },
        { passive: false },
    );
    els.container.addEventListener(
        "touchmove",
        (e) => {
            // prevent swipe to navigate gesture
            e.preventDefault();
        },
        { passive: false },
    );
    window.addEventListener("contextmenu", (event) => event.preventDefault());
}
/** canvas.ts */
import { els } from "./elements";
import { getPixelRatio, position } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import * as Comlink from "comlink";

export async function tranferCanvas() {
    els.canvas.addEventListener("webglcontextlost", (event) => {
        //event.preventDefault(); // 자동 복구를 브라우저에 맡기지 않기 위해 필요
        alert("WebGL context lost!");
    });

    els.canvas.addEventListener("webglcontextrestored", () => {
        alert("WebGL context restored!");
        // 모든 리소스 재초기화 필요
    });

    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

    console.log("screenHeight", position.screenHeight);

    let dpr = getPixelRatio();
    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
        position.screenWidth,
        position.screenHeight,
        dpr,
        position.width,
        position.height,
        position.x,
        position.y,
        position.scale,
    );

    // // 캔버스 렌더링
    // setCameraPosition();
    // resizeScreen();
    // resizeLayer();
    // render();
}
import { BrushTool } from "./BrushTool";
import { ResizeTool } from "./resizeTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";

export const toolRegistry = {
  brush: new BrushTool(),
  selection: new SelectionTool(),
  resize: new ResizeTool(),
  select: new SelectTool(),
};
// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, beforeSelectionPos, setBefore } from "../selection";
import {
  getSelectionHandleAtPoint,
  HandleType,
} from "../utils/selectionHitTest";
import {
  changeCanvasSize,
  getPixelRatio,
  position,
  to_pixel_canvas_coord,
} from "../position";

import { clamp } from "../utils/math";
import { dispatch } from "../events/pointerEvents";
import { paintConfig } from "@/paint.config";

export class ResizeTool {
  private activeHandle: HandleType | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime = 0;

  down(e: PointerEvent) {
    if (paintState.toolId !== "resize" || paintState.action !== "BRUSH") return;

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
    setBefore({
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    });

    const handle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    this.activeHandle = handle;
    this.start = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
    };
    console.log("handle:", handle);

    if (handle === "OUTSIDE" || this.activeHandle === "INSIDE") {
      this.startTime = performance.now();
    } else {
      selection.active = true;
    }
  }

  move(e: PointerEvent) {
    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const hoveredHandle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    switch (hoveredHandle) {
      case "LT":
      case "RB":
        selection.setHover("nwse-resize");
        break;
      case "RT":
      case "LB":
        selection.setHover("nesw-resize");
        break;
      case "T":
      case "B":
        selection.setHover("ns-resize");
        break;
      case "L":
      case "R":
        selection.setHover("ew-resize");
        break;
      case "INSIDE":
      case "OUTSIDE":
        selection.setHover("default");
        break;
    }

    if (!paintState.pointerdown) return;

    // 크기 조정 안하려고 하면 브러시로 이동
    if (this.activeHandle === "OUTSIDE" || this.activeHandle === "INSIDE") {
      paintState.setToolId("brush");
      selection.setShowHint(false);
      selection.setShowHandle(false);
      this.activeHandle = null;
      dispatch(e, "down");
      return;
    }

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    if (this.activeHandle) {
      let { x, y, w, h } = this.start;
      const p = point;

      switch (this.activeHandle) {
        case "RB":
          w = p.x - x + 1;
          h = p.y - y + 1;
          break;

        case "RT":
          h = y + h - p.y;
          y = p.y;
          w = p.x - x + 1;
          break;

        case "LB":
          w = x + w - p.x;
          x = p.x;
          h = p.y - y + 1;
          break;

        case "LT":
          w = x + w - p.x;
          h = y + h - p.y;
          x = p.x;
          y = p.y;
          break;

        case "R":
          w = p.x - x + 1;
          break;

        case "L":
          w = x + w - p.x;
          x = p.x;
          break;

        case "B":
          h = p.y - y + 1;
          break;

        case "T":
          h = y + h - p.y;
          y = p.y;
          break;
      }

      if (e.shiftKey) {
        const ratio = this.start.w / this.start.h;
        const curRatio = w / h;
        if (curRatio < ratio) w = Math.floor(h * ratio);
        else h = Math.floor(w / ratio);
        if (["L", "LT", "LB"].includes(this.activeHandle))
          x = this.start.x + this.start.w - w;
        if (["T", "LT", "RT"].includes(this.activeHandle))
          y = this.start.y + this.start.h - h;
      }

      const min = 1,
        max = paintConfig.maxSize;
      selection.setX(
        clamp(
          x,
          beforeSelectionPos.x + beforeSelectionPos.width - max,
          beforeSelectionPos.x + beforeSelectionPos.width - min,
        ),
      );
      selection.setY(
        clamp(
          y,
          beforeSelectionPos.y + beforeSelectionPos.height - max,
          beforeSelectionPos.y + beforeSelectionPos.height - min,
        ),
      );
      selection.setWidth(clamp(w, min, max));
      selection.setHeight(clamp(h, min, max));
    }
  }

  up() {
    if (!this.activeHandle) {
    } else if (
      !paintState.pointerdown &&
      (this.activeHandle == "OUTSIDE" || this.activeHandle == "INSIDE")
    ) {
      // 이러면 롱 클릭할때만 현상유지임
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        paintState.setToolId("brush");
        selection.setShowHint(false);
        selection.setShowHandle(false);
      }
    } else {
      let x = selection.x;
      let y = selection.y;

      selection.setX(0);
      selection.setY(0);
      console.log("resize!!!");
      changeCanvasSize(x, y, selection.width, selection.height);
    }

    selection.active = false;
    this.activeHandle = null;
  }
}

export const resizeTool = new ResizeTool();
// tools/ZoomTool.ts
import { paintState } from "../paintState";
import {
  position,
  renderChangedPosition,
  to_screen_coord,
  setMagification,
  getPixelRatio,
} from "../position";
import { zoomRect } from "../ui/zoomState";

const MIN_SCALE = 0.125;
const MAX_SCALE = 120;

export class ZoomTool {
  private active = false;

  down(e: PointerEvent) {
    if (paintState.action !== "ZOOM" || !paintState.pointerdown || this.active)
      return;

    this.active = true;
    zoomRect.setStart(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (paintState.action !== "ZOOM" || !paintState.pointerdown || !this.active)
      return;

    zoomRect.updateEnd(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (paintState.action !== "ZOOM" || !this.active) return;

    this.active = false;

    const sx = zoomRect.sx;
    const sy = zoomRect.sy;
    const ex = zoomRect.ex;
    const ey = zoomRect.ey;

    zoomRect.reset();

    const zoomW = Math.abs(sx - ex);
    const zoomH = Math.abs(sy - ey);
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2;

    let dpr = getPixelRatio();
    let max_scale = MAX_SCALE * dpr;

    if (zoomW < 10 || zoomH < 10) {
      let newMag = position.scale;
      newMag *= e.button === 2 ? 1 / 1.5 : 1.5;
      const clamped = Math.min(
        max_scale * getPixelRatio(),
        Math.max(MIN_SCALE, newMag),
      );
      setMagification(clamped, to_screen_coord(e.clientX, e.clientY));
    } else {
      const px = position.bouncingRect.width / zoomW;
      const py = position.bouncingRect.height / zoomH;
      const zoomFactor = Math.min(px, py);

      const centerX = position.bouncingRect.width / 2;
      const centerY =
        position.bouncingRect.height / 2 + position.bouncingRect.y;

      const dx = cx - centerX;
      const dy = cy - centerY;

      position.setX((position.x / dpr - dx / position.scale) * dpr);
      position.setY((position.y / dpr - dy / position.scale) * dpr);

      const newMag = position.scale * zoomFactor;
      const clamped = Math.min(max_scale, Math.max(MIN_SCALE, newMag));
      setMagification(clamped, to_screen_coord(centerX, centerY));
    }

    renderChangedPosition();
  }

  cancel() {
    this.active = false;
    zoomRect.reset();
  }
}

export const zoomTool = new ZoomTool();
// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, beforeSelectionPos, applySelection } from "../selection";
import {
  getSelectionHandleAtPoint,
  HandleType,
} from "../utils/selectionHitTest";
import { to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import { clamp } from "../utils/math";
import { paintConfig } from "@/paint.config";

export class SelectionTool {
  private activeHandle: HandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private startTime;

  down(e: PointerEvent) {
    if (paintState.toolId !== "selection" || paintState.action !== "BRUSH")
      return;
    if (!paintState.pointerdown) return;

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const handle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    this.activeHandle = handle;
    this.start = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
    };
    console.log("handle:", handle);
    if (handle === "INSIDE") {
      const point = to_pixel_canvas_coord(e.clientX, e.clientY);
      this.dragOffset = {
        x: point.x - selection.x,
        y: point.y - selection.y,
      };
      selection.active = true;
    } else if (handle === "OUTSIDE") {
      this.startTime = performance.now();
    } else {
      selection.active = true;
    }
  }

  move(e: PointerEvent) {
    // el.container의 커서를 grab으로, paintState.pointerdown이면 grabbing으로
    // 그리고 핸들 범위에 올라가면, nesw-resize이런 4개방향 화살표로.

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const hoveredHandle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    switch (hoveredHandle) {
      case "LT":
      case "RB":
        selection.setHover("nwse-resize");
        break;
      case "RT":
      case "LB":
        selection.setHover("nesw-resize");
        break;
      case "T":
      case "B":
        selection.setHover("ns-resize");
        break;
      case "L":
      case "R":
        selection.setHover("ew-resize");
        break;
      case "INSIDE":
        selection.setHover("move");
        break;
      case "OUTSIDE":
        selection.setHover("default");
        break;
    }

    if (!paintState.pointerdown) return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);

    if (this.activeHandle === "INSIDE") {
      if (!selection.active) return;

      selection.setShowHandle(false);
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      selection.setPosition(newX, newY);

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    } else if (this.activeHandle && this.activeHandle !== "OUTSIDE") {
      let { x, y, w, h } = this.start;
      const p = point;

      switch (this.activeHandle) {
        case "RB":
          w = p.x - x + 1;
          h = p.y - y + 1;
          break;

        case "RT":
          h = y + h - p.y;
          y = p.y;
          w = p.x - x + 1;
          break;

        case "LB":
          w = x + w - p.x;
          x = p.x;
          h = p.y - y + 1;
          break;

        case "LT":
          w = x + w - p.x;
          h = y + h - p.y;
          x = p.x;
          y = p.y;
          break;

        case "R":
          w = p.x - x + 1;
          break;

        case "L":
          w = x + w - p.x;
          x = p.x;
          break;

        case "B":
          h = p.y - y + 1;
          break;

        case "T":
          h = y + h - p.y;
          y = p.y;
          break;
      }

      if (e.shiftKey) {
        const ratio = this.start.w / this.start.h;
        const curRatio = w / h;
        if (curRatio < ratio) w = Math.floor(h * ratio);
        else h = Math.floor(w / ratio);
        if (["L", "LT", "LB"].includes(this.activeHandle))
          x = this.start.x + this.start.w - w;
        if (["T", "LT", "RT"].includes(this.activeHandle))
          y = this.start.y + this.start.h - h;
      }

      const min = 1,
        max = paintConfig.maxSize;
      selection.setX(
        clamp(
          x,
          beforeSelectionPos.x + beforeSelectionPos.width - max,
          beforeSelectionPos.x + beforeSelectionPos.width - min,
        ),
      );
      selection.setY(
        clamp(
          y,
          beforeSelectionPos.y + beforeSelectionPos.height - max,
          beforeSelectionPos.y + beforeSelectionPos.height - min,
        ),
      );
      selection.setWidth(clamp(w, min, max));
      selection.setHeight(clamp(h, min, max));

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    }
  }

  up() {
    if (!this.activeHandle) return;
    if (this.activeHandle === "INSIDE") {
      beforeSelectionPos.x = selection.x;
      beforeSelectionPos.y = selection.y;
      beforeSelectionPos.width = selection.width;
      beforeSelectionPos.height = selection.height;
      selection.setShowHandle(true);
    }
    if (!paintState.pointerdown && this.activeHandle == "OUTSIDE") {
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        paintState.setToolId("select");
      }
    }

    if (this.activeHandle != "OUTSIDE") {
      const worker = getLayerWorker();
      worker.endMove();
    }

    selection.active = false;
    this.activeHandle = null;
  }
}

export const selectionTool = new SelectionTool();
// tools/SelectTool.ts
import { paintState } from "../paintState";
import { selection } from "../selection";
import { position, to_pixel_canvas_coord } from "../position";
import { canvasSelect } from "../selection";
import { clamp } from "../utils/math";

export class SelectTool {
  private startPoint: { x: number; y: number } | null = null;
  private endPoint: { x: number; y: number } | null = null;
  private active = false;

  down(e: PointerEvent) {
    if (paintState.action !== "BRUSH" || paintState.toolId !== "select") return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width);
    const py = clamp(point.y, 0, position.height);

    this.startPoint = { x: px, y: py };
    this.endPoint = { x: px, y: py };
    this.active = true;
  }

  move(e: PointerEvent) {
    if (!this.active || !paintState.pointerdown) return;
    if (paintState.action !== "BRUSH" || paintState.toolId !== "select") return;
    
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width);
    const py = clamp(point.y, 0, position.height);
    this.endPoint = { x: px, y: py };

    const sp = {
      x: this.startPoint!.x + (this.startPoint!.x > this.endPoint.x ? 1 : 0),
      y: this.startPoint!.y + (this.startPoint!.y > this.endPoint.y ? 1 : 0),
    };
    const ep = {
      x: this.endPoint.x + (this.startPoint!.x <= this.endPoint.x ? 1 : 0),
      y: this.endPoint.y + (this.startPoint!.y <= this.endPoint.y ? 1 : 0),
    };

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x);
    const height = Math.abs(sp.y - ep.y);

    selection.setX(startX);
    selection.setY(startY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHint(true);
    selection.setShowHandle(false);
  }

  up(e: PointerEvent) {
    if (!this.active) return;
    this.active = false;

    const sp = {
      x: this.startPoint!.x + (this.startPoint!.x > this.endPoint!.x ? 1 : 0),
      y: this.startPoint!.y + (this.startPoint!.y > this.endPoint!.y ? 1 : 0),
    };
    const ep = {
      x: this.endPoint!.x + (this.startPoint!.x <= this.endPoint!.x ? 1 : 0),
      y: this.endPoint!.y + (this.startPoint!.y <= this.endPoint!.y ? 1 : 0),
    };

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x);
    const height = Math.abs(sp.y - ep.y);

    if (width === 0 || height === 0) {
      console.error("선택창이 0이 나올 수 없는데?");
      return;
    }
    if (width === 1 && height === 1) {
      console.log("1x1 선택창은 만들지 않습니다.");
      return;
    }

    selection.setShowHint(true);
    selection.setShowHandle(true);
    canvasSelect(startX, startY, width, height);
  }
}

export const selectTool = new SelectTool();
// tools/PanTool.ts
import { paintState } from "../paintState";
import { getPixelRatio, position, renderChangedPosition } from "../position";

export class PanTool {
  private lastClientX = 0;
  private lastClientY = 0;
  private active = false;

  down(e: PointerEvent) {
    if (paintState.action !== "PAN" || !paintState.pointerdown) return;
    this.active = true;

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
  }

  move(e: PointerEvent) {
    if (paintState.action !== "PAN" || !paintState.pointerdown || !this.active)
      return;

    const dx = (this.lastClientX - e.clientX) * getPixelRatio();
    const dy = (this.lastClientY - e.clientY) * getPixelRatio();

    const newX = position.x - dx / position.scale;
    const newY = position.y - dy / position.scale;

    position.setX(newX);
    position.setY(newY);

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    renderChangedPosition();
  }

  up(_: PointerEvent) {
    // No-op for pan
    if (paintState.action !== "PAN") return;
    this.active = false;
  }

  cancel() {
    // 선택적으로 추가 가능
    this.active = false;
  }
}

export const panTool = new PanTool();
import { paintState } from "../paintState";
import { getLayerWorker } from "../worker/workerPool";
import {  to_canvas_coord } from "../position";
import { colorState } from "../colorState";

export class BrushTool {
  private active = false;
  private start = { x: 0, y: 0 };

  down(e: PointerEvent) {
    if (!paintState.pointerdown || paintState.toolId !== "brush") return;
    this.active = true;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();

    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    let { r, g, b } = colorState.getRGB();
    worker.setStrokeColor(r, g, b);

    worker.start(point);

    this.start = point;

    paintState.setMoved(false);
  }

  move(e: PointerEvent) {
    if (
      !paintState.pointerdown ||
      !this.active ||
      paintState.toolId !== "brush"
    )
      return;

    paintState.setMoved(true);

    const worker = getLayerWorker();
    const brushSize = paintState.getBrushSize();
    const point = to_canvas_coord(e.clientX, e.clientY);

    const dx = point.x - this.start.x;
    const dy = point.y - this.start.y;
    //if (Math.hypot(dx, dy) > 4/ position.scale) {
    this.start = point;
    worker.strokeTo(point);
    //}

    paintState.setDrawing(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (!this.active || paintState.toolId !== "brush") return;
    this.active = false;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();
    if (this.start.x == point.x && this.start.y == point.y) {
      worker.strokeTo(point);
    }

    worker.end();
    paintState.setMoved(false);
    paintState.changed = true;
  }

  cancel() {
    console.log("brushCancel");
    this.active = false;

    getLayerWorker().cancel();
  }
}
const en_pack = {
  current_language: "English",
  paint: "paint",
  tools: "Tools",
  select: "Select",
  brush: "Brush",
  eraser: "Eraser",
  size: "Size",
  opacity: "Opacity",
  color: "Color",
  choose_color: "Choose Color",
  new: "New",
  open: "Open",
  save: "Save",
  undo: "Undo",
  redo: "Redo",
  you_can_translation:
    "Would you like to switch to the English version of the site?",
};

const ko_pack: typeof en_pack = {
  current_language: "한국어",
  paint: "그림판",
  tools: "도구",
  select: "선택",
  brush: "브러시",
  eraser: "지우개",
  size: "크기",
  opacity: "투명도",
  color: "색",
  choose_color: "색 선택",
  new: "새로 만들기",
  open: "열기",
  save: "저장",
  undo: "뒤로 가기",
  redo: "앞으로 가기",
  you_can_translation: "한국어 페이지로 이동하시겠습니까?",
};

export const languagePack = {
  en: en_pack,
  ko: ko_pack,
};

export type Letter = keyof typeof en_pack;
import { languagePack, Letter } from "./languagePack";

let currentLang = "en";

export function setLanguage(lang) {
  if (existLang(lang)) {
    currentLang = lang;
  } else {
    currentLang = "en";
  }
}

setLanguage(window.lang);

export function getLetter(key: Letter, lang = currentLang) {
  let currentPack = languagePack[lang];
  return currentPack[key];
}

export function existLang(lang) {
  if (languagePack[lang]) return true;

  return false;
}

const getBrowserLang = () => {
  const lang = navigator.language || navigator.languages?.[0];
  return lang?.split("-")[0]; // 'ko-KR' → 'ko'
};

// 브라우저 언어가 현재 사이트 언어랑 다르고, 지원 목록에 있다면 true
export const getSuggestedLang = () => {
  const browserLang = getBrowserLang();
  if (browserLang && browserLang !== currentLang && languagePack[browserLang]) {
    return browserLang;
  }
  return null;
};
import { paintState } from "../paintState";
import { toolRegistry } from "../tools/toolRegistry";
import { panTool } from "../tools/PanTool";
import { zoomTool } from "../tools/ZoomTool";

type Phase = "down" | "move" | "up" | "cancel";

export function dispatch(e: PointerEvent, phase: Phase) {
  // 1. 모드(action)가 PAN, ZOOM이면 우선 분기
  switch (paintState.action) {
    case "PAN":
      panTool[phase]?.(e);
      return;
    case "ZOOM":
      zoomTool[phase]?.(e);
      return;
  }

  // 2. 기본 도구 (BRUSH, SELECT, RESIZE 등)는 toolId 기준
  const tool = toolRegistry[paintState.toolId];
  tool?.[phase]?.(e);
}

// 프레임당 1회 move 디스패치 제어용 변수
let moveQueued = false;
//let lastMoveEvent: PointerEvent | null = null;

function throttledMove(e: PointerEvent) {
 // console.log('move')
  if (moveQueued) return;

  moveQueued = true;
  dispatch(e, "move");

  requestAnimationFrame(() => {
    moveQueued = false;
  });
}

export function attachPointerEvents(root: HTMLElement) {
  root.addEventListener("pointerdown", (e) => dispatch(e, "down"), {
    passive: false,
  });

  window.addEventListener("pointermove", throttledMove, {
    passive: false,
  });

  window.addEventListener("pointerup", (e) => dispatch(e, "up"), {
    passive: false,
  });
}
/** keyboard.ts */
import { paintState } from "../paintState";
import { cancel, toolManager } from "../draw";
import { applySelection, canvasSelect, selectionDelete } from "../selection";
import {
  getPixelRatio,
  MAX_SCALE,
  MIN_SCALE,
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
import { clamp } from "../utils/math";
import { redo, undo } from "../history";

function addWheelListener() {
  /**
   * 휠 스크롤 영역
   */
  (function () {
    window.addEventListener(
      "wheel",
      (event) => {
        //console.log("wheel", event);
        let ctrlKey = event.ctrlKey || event.metaKey;

        if (ctrlKey) {
          event.preventDefault();

          const clampedDelta = clamp(event.deltaY, -12, 12);
          const percent = -clampedDelta * 0.01 + 1;
          const new_mag = position.scale * percent;

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
          let dpr = getPixelRatio();
          if (event.shiftKey && event.deltaX === 0) {
            position.setX(position.x - (event.deltaY / position.scale) * dpr);
            position.setY(position.y - (event.deltaX / position.scale) * dpr);
          } else {
            position.setX(position.x - (event.deltaX / position.scale) * dpr);
            position.setY(position.y - (event.deltaY / position.scale) * dpr);
          }
        }

        renderChangedPosition();
      },
      { passive: false },
    );
  })();
}

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

export function addKeyboardEvent() {
  addKeyActionChangeEventListener();
  addWheelListener();

  // 키보드 이벤트
  (function () {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      // console.log(target);
      if (isInput) return; // 인풋창이면 기본 이벤트 허용

      let ctrlKey = event.ctrlKey || event.metaKey;

      if (ctrlKey && event.code === "KeyZ" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (ctrlKey && event.code === "KeyZ" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

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
    // 키보드를 떼면 눌려있는 키가 적용되어야 한다.
    setTimeout(() => {
      applyKeyAction(); // 가장 마지막에 작동하게 함
      //console.log("apply");
    }, 0);
  });
}
import { paintState } from "../paintState";
import { cancel } from "../draw";
import { dispatch } from "./pointerEvents";
import {
  getPixelRatio,
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
import { redo, undo } from "../history";
const MIN_SCALE = 0.125;
const MAX_SCALE = 120;
const twoFingerTapInterval = 75; // 이중클릭 범위
const doubleTapInterval = 250; // 더블클릭 범위
const TWO_CLICK_INTERVAL = 150;
const THREE_CLICK_INTERVAL = 200;

const pointers = new Map(); // pointerId -> {x, y} 저장

export function addGestureEvent() {
  let pointerIndex = 0;

  let lastPinchDistance;
  let lastPinchCenterPos;
  let firstPointerdownTime = 0;
  let lastDoubleTouchTime = 0;
  let moveDistance = 0;

  function averageTouches() {
    if (pointers.size < 2) throw new Error("포인터가 2개 미만"); // 포인터가 2개 미만이면 평균 계산 불가

    // 1. pointerId를 오름차순 정렬하여 가장 낮은 두 개 선택
    const sortedPointers = Array.from(pointers.values()).sort(
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

  let twoPingerDown = 0;
  let threePingerDown = 0;
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
        alert(
          "포인터 아이디가 이미 있는데 또 pointerdown? 버그임 근데 이문제 자꾸 나는데 꼭 해결해야함",
        );
      }

      // 핀치 줌
      if (pointers.size === 1) {
        paintState.setPointerdown(true);
        firstPointerdownTime = performance.now();
        moved = false;
      }

      if (pointers.size === 2) {
        let now = performance.now();
        // 두 손가락이 거의 동시에 down
        if (now - firstPointerdownTime <= twoFingerTapInterval) {
          // twoFingerTapInterval 이내에 그려진 내용 취소
          cancel();

          twoPingerDown = now;
          if (now - lastDoubleTouchTime <= doubleTapInterval) {
            //alert(`더블터치! ${now - lastDoubleTouchTime}`);
            lastDoubleTouchTime = 0;
          } else {
            lastDoubleTouchTime = now;
          }
        } else {
          dispatch(event, "up");
        }

        paintState.setPointerdown(false);
        paintState.setDrawing(false);

        console.log("두 손가락 감지됨, 핀치 줌 시작");
        paintState.setAction("PINCH");

        lastPinchCenterPos = averageTouches();
        const points = Array.from(pointers.values());
        lastPinchDistance = Math.hypot(
          points[0].clientX - points[1].clientX,
          points[0].clientY - points[1].clientY,
        );
      }
      if (pointers.size === 3) {
        let now = performance.now();
        // 세 손가락이 거의 동시에 down
        if (now - firstPointerdownTime <= twoFingerTapInterval) {
          threePingerDown = now;
        }
      }
    },
    true,
  );

  let moved = false;
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

      let diffX = (dx / position.scale) * getPixelRatio();
      let diffY = (dy / position.scale) * getPixelRatio();

      moved = true;

      position.setX(position.x - diffX);
      position.setY(position.y - diffY);
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
      let now = performance.now();

      if (now - threePingerDown < THREE_CLICK_INTERVAL && !moved) {
        redo();
        twoPingerDown = 0;
        threePingerDown = 0;
      } else if (now - twoPingerDown < TWO_CLICK_INTERVAL && !moved) {
        undo();
        twoPingerDown = 0;
      }

      paintState.setPointerdown(false);
      paintState.setDrawing(false);

      if (pointers.has(event.pointerId)) {
        pointers.delete(event.pointerId);
        // console.log("포인터 제거!", event.pointerId);
      }

      // 핀치 줌
      if (paintState.action !== "PINCH") return;

      if (pointers.size == 0) {
        paintState.setAction("BRUSH");
        moved = false;
      }
    },
    true,
  );

  window.addEventListener(
    "pointercancel",
    (event) => {
      paintState.setPointerdown(false);
      paintState.setDrawing(false);

      if (pointers.has(event.pointerId)) {
        pointers.delete(event.pointerId);
        console.log("포인터 제거!", event.pointerId);
      }
    },
    true,
  );
}
import React, {useEffect, useLayoutEffect} from "react";

export function useClickOutside(
  refs: React.RefObject<HTMLElement | null>[],
  handler: () => void,
) {
  useEffect(() => {
    const listener = (e: PointerEvent) => {
      if (refs.every((ref) => !ref.current?.contains(e.target as Node))) {
        handler();
      }
    };
    document.addEventListener("pointerdown", listener);
    return () => {
      document.removeEventListener("pointerdown", listener);
    };
  }, [refs, handler]);
}

export function useDropdownPosition(
  buttonRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  show: boolean,
  options?: {
    padding?: number;
    offsetX?: number;
    offsetY?: number;
    /** true → 기본 위치를 버튼 위로, false → 버튼 아래로 */
    invertY?: boolean;
  },
) {
  const padding  = options?.padding  ?? 8;
  const offsetX  = options?.offsetX  ?? 0;
  const offsetY  = options?.offsetY  ?? 0;
  const invertY  = options?.invertY ?? false;

  useLayoutEffect(() => {
    if (!show) return;

    const button = buttonRef.current;
    const menu   = menuRef.current;
    if (!button || !menu) return;

    const rect            = button.getBoundingClientRect();
    const menuWidth       = menu.offsetWidth;
    const menuHeight      = menu.offsetHeight;
    const viewportWidth   = window.innerWidth;
    const viewportHeight  = window.innerHeight;

    /* ─────────────── X 좌표 계산 ─────────────── */
    let left = rect.left + offsetX;

    // 오른쪽·왼쪽 경계 보정
    if (left + menuWidth + padding > viewportWidth) {
      left = viewportWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    /* ─────────────── Y 좌표 계산 ─────────────── */
    // invertY가 true면 기본 위치를 위쪽으로, false면 아래쪽으로
    const above = rect.top  - menuHeight - offsetY;
    const below = rect.bottom + offsetY;
    let top     = invertY ? above : below;

    // 화면 밖으로 튀면 반대쪽으로 fallback
    if (invertY) {
      if (top < padding) top = below;
    } else {
      if (top + menuHeight + padding > viewportHeight) top = above;
    }

    // 최종 경계 체크
    if (top < padding) top = padding;
    if (top + menuHeight + padding > viewportHeight) {
      top = viewportHeight - menuHeight - padding;
    }

    /* ─────────────── 스타일 적용 ─────────────── */
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;
  }, [buttonRef, menuRef, show, padding, offsetX, offsetY, invertY]);
}// 헬퍼 함수
export function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

export function createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link failed:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }
    return program;
}

export async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

const glHelpers = new Map();

/**
 * gl 관련 유틸리티 프로그램 모음
 */
export function getGlHelper(gl) {
    if (glHelpers.has(gl)) {
        return glHelpers.get(gl);
    }

    const clearTexture = createClearTextureFunc(gl);
    const clearTextureVec2 = createClearTextureFuncvec2(gl);
    /////
    const helper = {
        clearTexture,
        clearTextureVec2,
    };

    glHelpers.set(gl, helper);

    return helper;
}

/**
 * 텍스쳐를 초기화 해주는 프로그램
 */
function createClearTextureFunc(gl) {
    // 1. FBO 생성
    const fbo = gl.createFramebuffer();

    // 2. 쉐이더 프로그램 생성
    const vsSource = `#version 300 es
        precision highp float;
        in vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

    const fsSource = `#version 300 es
        precision highp float;
        out float fragColor;

        uniform float u_clearValue;

        void main() {
            fragColor = u_clearValue;
        }`;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // 3. 풀스크린 사각형 렌더링
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );

    let posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const clearTexture = (texture, width, height, clearValue = 0.0) => {
        gl.useProgram(program);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
        );

        gl.uniform1f(
            gl.getUniformLocation(program, "u_clearValue"),
            clearValue,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    return clearTexture;
}

function createClearTextureFuncvec2(gl) {
    // 1. FBO 생성
    const fbo = gl.createFramebuffer();

    // 2. 쉐이더 프로그램 생성
    const vsSource = `#version 300 es
        precision highp float;
        in vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

    const fsSource = `#version 300 es
        precision highp float;
        out vec4 fragColor;

        uniform vec2 u_clearValue;

        void main() {
            fragColor = vec4(u_clearValue, 0.0, 0.0);
        }`;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // 3. 풀스크린 사각형 렌더링
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );

    let posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const clearTexture = (texture, width, height, clearValue = [0.0, 0.0]) => {
        gl.useProgram(program);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
        );

        gl.uniform2f(
            gl.getUniformLocation(program, "u_clearValue"),
            clearValue[0],
            clearValue[1],
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    return clearTexture;
}
export function decodePremultAndFlip(
  flippedPixel: Uint8Array,
  width,
  height,
): Uint8ClampedArray {
  // 최종 픽셀 (논프멀, 위에서 아래로 플립됨)
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    const srcStart = row * width * 4;
    const dstStart = (height - row - 1) * width * 4;

    for (let i = 0; i < width; i++) {
      const srcIndex = srcStart + i * 4;
      const dstIndex = dstStart + i * 4;

      const r = flippedPixel[srcIndex + 0];
      const g = flippedPixel[srcIndex + 1];
      const b = flippedPixel[srcIndex + 2];
      const a = flippedPixel[srcIndex + 3];

      if (a > 0) {
        const factor = 255 / a;
        pixels[dstIndex + 0] = Math.min(r * factor, 255);
        pixels[dstIndex + 1] = Math.min(g * factor, 255);
        pixels[dstIndex + 2] = Math.min(b * factor, 255);
      } else {
        // 알파 0이면 RGB도 0
        pixels[dstIndex + 0] = 0;
        pixels[dstIndex + 1] = 0;
        pixels[dstIndex + 2] = 0;
      }

      pixels[dstIndex + 3] = a;
    }
  }

  return pixels;
}


const decodePremultAndFlip2 = (() => {
  return function (
    flippedPixel: Uint8Array,
    width: number,
    height: number,
  ): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let row = 0; row < height; row++) {
      const srcStart = row * width * 4;
      const dstStart = (height - row - 1) * width * 4;

      for (let i = 0; i < width; i++) {
        const srcIndex = srcStart + i * 4;
        const dstIndex = dstStart + i * 4;

        const a = flippedPixel[srcIndex + 3];
        const factor = a > 0 ? 255 / a : 0;

        pixels[dstIndex + 0] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 0] * factor, 255) : 0;
        pixels[dstIndex + 1] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 1] * factor, 255) : 0;
        pixels[dstIndex + 2] =
          a > 0 ? Math.min(flippedPixel[srcIndex + 2] * factor, 255) : 0;
        pixels[dstIndex + 3] = a;
      }
    }

    return pixels;
  };
})();
import { clamp } from "@/utils/math";
import { paintOptions } from "../texture";

export class DirtyRect {
  pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

  constructor(x = 0, y = 0, ex = 0, ey = 0) {
    this.pathDirtyRect = { x, y, ex, ey };
  }
  static fromWidth(x, y, width, height) {
    return new DirtyRect(x, y, width + x - 1, height + y - 1);
  }
  static copy(rect) {
    return DirtyRect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  get x() {
    return clamp(this.pathDirtyRect.x, 0, paintOptions.width - 1);
  }

  get y() {
    return clamp(this.pathDirtyRect.y, 0, paintOptions.height - 1);
  }

  get ex() {
    return clamp(this.pathDirtyRect.ex, 0, paintOptions.width - 1);
  }

  get ey() {
    return clamp(this.pathDirtyRect.ey, 0, paintOptions.height - 1);
  }

  get width() {
    return this.ex - this.x + 1;
  }

  get height() {
    return this.ey - this.y + 1;
  }

  updatePointer(pointer, radius) {
    let minX = Math.min(this.pathDirtyRect.x, Math.floor(pointer.x - radius));
    let maxX = Math.max(this.pathDirtyRect.ex, Math.floor(pointer.x + radius));
    let minY = Math.min(this.pathDirtyRect.y, Math.floor(pointer.y - radius));
    let maxY = Math.max(this.pathDirtyRect.ey, Math.floor(pointer.y + radius));

    this.pathDirtyRect.x = minX;
    this.pathDirtyRect.y = minY;
    this.pathDirtyRect.ex = maxX;
    this.pathDirtyRect.ey = maxY;
  }

  reset(pointer: Pointer, radius) {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

    this.pathDirtyRect.x = Math.floor(pointer.x - radius);
    this.pathDirtyRect.y = Math.floor(pointer.y - radius);
    this.pathDirtyRect.ex = Math.floor(pointer.x + radius);
    this.pathDirtyRect.ey = Math.floor(pointer.y + radius);
  }
}

export class Rect {
  pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

  constructor(x = 0, y = 0, ex = 0, ey = 0) {
    this.pathDirtyRect = { x, y, ex, ey };
  }
  static fromWidth(x, y, width, height) {
    return new Rect(x, y, width + x - 1, height + y - 1);
  }
  static copy(rect) {
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  get x() {
    return this.pathDirtyRect.x;
  }

  get y() {
    return this.pathDirtyRect.y;
  }

  get ex() {
    return this.pathDirtyRect.ex;
  }

  get ey() {
    return this.pathDirtyRect.ey;
  }

  get width() {
    return this.ex - this.x + 1;
  }

  get height() {
    return this.ey - this.y + 1;
  }

  updatePointer(pointer, radius) {
    let minX = Math.min(this.pathDirtyRect.x, Math.floor(pointer.x - radius));
    let maxX = Math.max(this.pathDirtyRect.ex, Math.floor(pointer.x + radius));
    let minY = Math.min(this.pathDirtyRect.y, Math.floor(pointer.y - radius));
    let maxY = Math.max(this.pathDirtyRect.ey, Math.floor(pointer.y + radius));

    this.pathDirtyRect.x = minX;
    this.pathDirtyRect.y = minY;
    this.pathDirtyRect.ex = maxX;
    this.pathDirtyRect.ey = maxY;
  }

  reset(pointer: Pointer, radius) {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

    this.pathDirtyRect.x = Math.floor(pointer.x - radius);
    this.pathDirtyRect.y = Math.floor(pointer.y - radius);
    this.pathDirtyRect.ex = Math.floor(pointer.x + radius);
    this.pathDirtyRect.ey = Math.floor(pointer.y + radius);
  }
}

interface Pointer {
  x: number;
  y: number;
}
// 1) gl(WeakMap의 key가 될 만한 객체)
// 2) key(문자열)
// 3) creator() (리소스를 새로 만들 때 호출)

const managerStore = new WeakMap<object, Map<string, unknown>>();

export function getManager<T>(
  gl: object,
  key: string,
  creator: () => T
): T {
  // gl에 해당하는 Map 가져오기
  let subMap = managerStore.get(gl);
  if (!subMap) {
    // 처음 보는 gl이면 새 Map 생성 후 등록
    subMap = new Map<string, unknown>();
    managerStore.set(gl, subMap);
  }

  // key에 해당하는 값이 없으면 새로 만들어 등록
  if (!subMap.has(key)) {
    const newValue = creator();
    subMap.set(key, newValue);
  }

  // 값 반환 (타입 보장을 위해 as T)
  return subMap.get(key) as T;
}import { getLiquifyManager, installLiquifyManager } from "./liquify";
import { getBrushManager } from "./brushTool";
import { setDrawingFlag } from "../history/pixelReadProcessor";

interface Pointer {
  x: number;
  y: number;
}

interface Tool {
  enter(): void;
  start(pointer: Pointer): void;
  stroke(p1: Pointer, p2: Pointer): void;
  end(): void;
  cancel(): void;
  exit(): void;
}

export async function installTools(canvas, gl) {
  await installLiquifyManager(canvas, gl);
  console.log("Tool Installed");
}

export class BrushTool implements Tool {
  drawManager;

  constructor(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {
   // console.log("brush enter");
    this.drawManager.enter();
  }
  start(pointer: Pointer) {
    setDrawingFlag(true);
    this.drawManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.brush();
  }
  end() {
    //console.log("brush end");
    this.drawManager.end();

  }
  cancel() {
    this.drawManager.cancel();
  }
  exit() {
   // console.log("brush exit");
  }
}

export class EraserTool implements Tool {
  drawManager;
  constructor(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {
    this.drawManager.enter();
  }
  start(pointer: Pointer) {
    this.drawManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.eraser();
  }
  end() {
    this.drawManager.end();
  }
  cancel() {
    this.drawManager.cancel();
  }
  exit() {}
}

export class LiquifyTool implements Tool {
  liquifyManager;
  constructor(canvas, gl) {
    this.liquifyManager = getLiquifyManager(canvas, gl);
  }
  enter() {
    //console.log("liquify enter");
    this.liquifyManager.enter();
  }
  start(pointer: Pointer) {
   // console.log("liquify start");
    this.liquifyManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.liquifyManager.push(p1, p2);
    this.liquifyManager.render();
  }
  end() {
    //console.log("liquify end");
    this.liquifyManager.end();
  }
  cancel() {
    this.liquifyManager.cancel();
  }
  exit() {
    //console.log("liquify exit");
    this.liquifyManager.exit();
  }
}
import liquifyPush from "./liquifyPush.glsl?raw";
const _xorKey = 73;

export function getShaderSource(): string {
  return liquifyPush;
  // return String.fromCharCode(
  //   ..._shaderData.map((c, i) => c ^ (_xorKey + (i % 5)))
  // );
}
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { getBufferManager, getFullQuadShader } from "../vertexShader";

import {
  getIntegralEaseInOut,
  getIntegralEaseInOutMirror,
} from "./cachedIntegrals";

import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import { getShaderSource } from "./liquifyShader";
import { DirtyRect, Rect } from "../utils/dirtyRect";
import { getManager } from "../utils/cachedManager";
import { getHistoryManager, HistoryItem } from "../history/history";
import {
  pushReadPixelQueue,
  setDrawingFlag,
} from "../history/pixelReadProcessor";
import { PixelReader } from "../history/PixelReader";

interface liquifyManager {
  enter(): void;

  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  render: () => void;

  end(): void;

  cancel(): void;

  exit(): void;

  setSize: () => void;

  displacementTex;
  displaceFBO;
}

const liquifyManagerStore = new Map<any, liquifyManager>();

export async function installLiquifyManager(canvas, gl) {
  let liquifyManager = await makeLiquifyManager(canvas, gl);
  liquifyManagerStore.set(gl, liquifyManager);
}

export function getLiquifyManager(canvas, gl) {
  let liquifyManager = liquifyManagerStore.get(gl);
  if (!liquifyManager) {
    console.error("Not Installed LiquifyManager!");
  }

  return liquifyManager;
}

async function makeLiquifyManager(canvas, gl) {
  let integralData = await getIntegralEaseInOut(); // 함수 내부에서 캐싱됌 많이 실행해도 ㄱㅊ
  let integralMirrorData = await getIntegralEaseInOutMirror();

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    console.error("EXT_color_buffer_float not supported!");
  }
  const extFloatLinear =
    gl.getExtension("OES_texture_float_linear") ||
    gl.getExtension("EXT_texture_filter_float");
  if (!extFloatLinear) {
    console.error(
      "This device does not support linear filtering for float textures.",
    );
  }

  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);

  let liquifyPushShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    getShaderSource(),
  );
  let liquifyPushProgram = createProgram(
    gl,
    fullQuadVertexShader,
    liquifyPushShader,
  );
  gl.useProgram(liquifyPushProgram);

  // 변위맵 텍스처 생성 및 데이터 업로드
  let displacementTexInput = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
  gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);

  // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 대문에
  // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_displacement"),
    TEXTURE_UNIT.DISPLACEMENT,
  );

  // 출력용 텍스처 생성
  let displacementTexOutput = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const integralTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_INTEGRAL);
  gl.bindTexture(gl.TEXTURE_2D, integralTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    integralData.length,
    1,
    0,
    gl.RED,
    gl.FLOAT,
    integralData,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_ease_integral"),
    TEXTURE_UNIT.EASE_INTEGRAL,
  );

  const integralMirrorTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_MIRROR);
  gl.bindTexture(gl.TEXTURE_2D, integralMirrorTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    integralMirrorData.length,
    1,
    0,
    gl.RED,
    gl.FLOAT,
    integralMirrorData,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_ease_mirror"),
    TEXTURE_UNIT.EASE_MIRROR,
  );

  // 프레임버퍼 생성 및 바인딩
  let displaceInFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, displaceInFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    displacementTexInput,
    0,
  );

  // 쓰여진 결과를 기본 변위맵에 업로드 하기 위해서
  let displaceOutFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, displaceOutFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    displacementTexOutput,
    0,
  );

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(liquifyPushProgram);

  let colorShaderSource = `#version 300 es
      precision mediump float;
      uniform sampler2D u_displacement;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {

          vec2 value = texture(u_displacement, v_texCoord).xy;
          vec2 dif = value / u_resolution;

          vec2 target = v_texCoord + dif;

          // 범위 넘어가면 투명하게 되는건 나중에 구현이 더 필요함.
          // 테두리 보간 해야함!
          if (target.x < 0.0 || target.x > 1.0 ||
              target.y < 0.0 || target.y > 1.0) {
              // 경계 외부는 투명색 반환
              outColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
                // vec4 newColor = texture(u_source, target);
                // float newAlpha = newColor.a;
                // outColor = vec4(newColor.rgb, newAlpha);
               outColor = texture(u_source, target);
                // outColor = vec4(0.0,1.0,0.0,value.y/8.0);
          }
      }
      `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, colorShaderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_displacement"),
    TEXTURE_UNIT.DISPLACEMENT,
  );

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(renderProgram);

  ////////////////
  let pathDirty = new DirtyRect();
  let imageDirty: DirtyRect | null = null;
  let sourceImageDirty: DirtyRect | null = null;
  /////////////////////////////

  function setSize() {
    const width = paintOptions.width;
    const height = paintOptions.height;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    gl.useProgram(liquifyPushProgram);

    gl.uniform2f(
      gl.getUniformLocation(liquifyPushProgram, "u_resolution"),
      width,
      height,
    );

    gl.useProgram(renderProgram);
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      width,
      height,
    );
  }

  let layerManager = getLayerManager(canvas, gl);
  let renderingManager = getRenderingManager(canvas, gl);

  function start(pointer) {
    //console.log("시작!");

    let ceiledRadius = Math.ceil(paintOptions.radius);
    pathDirty.reset(pointer, ceiledRadius);
    if (imageDirty) {
      //console.log("liq dirty updatePointer...");
      imageDirty.updatePointer(pointer, ceiledRadius);
    } else {
      imageDirty = new DirtyRect();
      //console.log("liq dirty reset!!!");
      imageDirty.reset(pointer, ceiledRadius);
    }
  }
  // init 시에 한 번만 호출 (ex. setSize()나 초기화 구간)
  const u_radiusLoc = gl.getUniformLocation(liquifyPushProgram, "u_radius");
  const u_strengthLoc = gl.getUniformLocation(liquifyPushProgram, "u_strength");
  const u_startLoc = gl.getUniformLocation(liquifyPushProgram, "u_start");
  const u_endLoc = gl.getUniformLocation(liquifyPushProgram, "u_end");

  let scissorDirty = new DirtyRect();
  function push(start, end) {
    gl.useProgram(liquifyPushProgram);
    // 유나폼 변수 설정
    gl.uniform1f(u_radiusLoc, paintOptions.radius);
    gl.uniform1f(u_strengthLoc, paintOptions.alpha);
    gl.uniform2f(u_startLoc, start.x, start.y);
    gl.uniform2f(u_endLoc, end.x, end.y);

    scissorDirty.reset(start, paintOptions.radius);
    scissorDirty.updatePointer(start, paintOptions.radius);
    scissorDirty.updatePointer(end, paintOptions.radius);

    pathDirty.updatePointer(start, paintOptions.radius);
    pathDirty.updatePointer(end, paintOptions.radius);
    imageDirty.updatePointer(start, paintOptions.radius);
    imageDirty.updatePointer(end, paintOptions.radius);

    // 렌더 대상: output
    gl.bindFramebuffer(gl.FRAMEBUFFER, displaceOutFBO);

    // SCISSOR TEST로 일부만 렌더링
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.width,
      scissorDirty.height,
    );
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // output 텍스처를 input 텍스쳐에도 옮기기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceOutFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, displaceInFBO);

    gl.blitFramebuffer(
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.ex + 1,
      scissorDirty.ey + 1, // 소스
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.ex + 1,
      scissorDirty.ey + 1, // 대상
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function render() {
    gl.useProgram(renderProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    renderingManager.render(Rect.copy(scissorDirty));
  }

  function clearMap() {
    let width = paintOptions.width;
    let height = paintOptions.height;

    let glHelper = getGlHelper(gl);
    glHelper.clearTextureVec2(displacementTexInput, width, height, [0, 0]);
    glHelper.clearTextureVec2(displacementTexOutput, width, height, [0, 0]);
    glHelper.clearTextureVec2(sourceDisplacementTex, width, height, [0, 0]);
  }

  let sourceDisplacementTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
  gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let sourceDisplacementFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sourceDisplacementFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    sourceDisplacementTex,
    0,
  );

  const fbo = gl.createFramebuffer();

  function makeDirtyTexture(pathDirty) {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      pathDirty.width,
      pathDirty.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여  ��면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0,
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      0,
      0,
      pathDirty.width,
      pathDirty.height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  function applyHistory(pixelReader, rect) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.HALF_FLOAT,
      pixelReader.getPixelData(),
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceInFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceDisplacementFBO);

    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function uploadAndMakeHistory(x, y, width, height) {
    let renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT,
    );
    pushReadPixelQueue(gl, beforePixelReader);

    let beforeDirty: DirtyRect | null = null;
    if (sourceImageDirty) {
      beforeDirty = DirtyRect.copy(sourceImageDirty);
    }

    let beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.pixelReader, this.rect);
        imageDirty = beforeDirty;
      },
    };

    // sourceMap으로 업로드
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceInFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceDisplacementFBO);
    gl.blitFramebuffer(
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT,
    );
    pushReadPixelQueue(gl, afterPixelReader);
    let afterDirty: DirtyRect | null = null;
    if (imageDirty) {
      afterDirty = DirtyRect.copy(imageDirty);
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.pixelReader, this.rect);
        imageDirty = afterDirty;
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  function clearAndMakeHistory(x, y, width, height) {
    let renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT,
    );
    pushReadPixelQueue(gl, beforePixelReader);
    let beforeDirty: DirtyRect | null = null;
    if (sourceImageDirty) {
      beforeDirty = DirtyRect.copy(sourceImageDirty);
    }
    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.pixelReader, this.rect);
        imageDirty = beforeDirty;
      },
    };

    // 클리어
    clearMap();

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT,
    );
    pushReadPixelQueue(gl, afterPixelReader);
    let afterDirty: DirtyRect | null = null;
    if (imageDirty) {
      afterDirty = DirtyRect.copy(imageDirty);
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      apply() {
        applyHistory(this.pixelReader, this.rect);
        imageDirty = afterDirty;
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }
  function restore(pathDirty) {
    let liquifyManager = getLiquifyManager(canvas, gl);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, liquifyManager.displaceFBO);

    gl.blitFramebuffer(
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  setSize();

  function openTexture() {
    //console.log("openTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );
  }

  function closeTexture() {
    //console.log("closeTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );
  }

  let Liquify = {
    enter() {
      openTexture();
      const newHistory = new HistoryObject(gl, {
        undo: () => {
          closeTexture();
          return "brush";
        },
        redo: () => {
          openTexture();
          return "liquify";
        },
      });
      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
    },
    start,
    push,
    render,
    end() {
      const { before, after } = uploadAndMakeHistory(
        pathDirty.x,
        pathDirty.y,
        pathDirty.width,
        pathDirty.height,
      );
      const newHistory = new HistoryObject(gl, {
        undo: () => {
          before.apply();
          render();
          return "liquify";
        },
        redo: () => {
          after.apply();
          render();
          return "liquify";
        },
      });

      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);

      sourceImageDirty = DirtyRect.copy(imageDirty);
    },
    cancel() {
      restore(pathDirty);

      render();
    },
    exit() {
      imageDirty = null;
      let historyManager = getHistoryManager(canvas, gl);

      if (sourceImageDirty) {
        const { before, after } = clearAndMakeHistory(
          sourceImageDirty.x,
          sourceImageDirty.y,
          sourceImageDirty.width,
          sourceImageDirty.height,
        );
        let { before: beforeSource, after: afterSource } =
          sourceTextureManager.upload(
            sourceImageDirty.x,
            sourceImageDirty.y,
            sourceImageDirty.width,
            sourceImageDirty.height,
          );

        const newHistory = new HistoryObject(gl, {
          undo: () => {
            openTexture();
            before.apply();
            beforeSource.apply();
            render();
            return "liquify";
          },
          redo: () => {
            after.apply();
            afterSource.apply();
            render();
            closeTexture();
            return "brush";
          },
        });

        historyManager.addUndo(newHistory);
      } else {
        const newHistory = new HistoryObject(gl, {
          undo: () => {
            openTexture();
            render();
            return "liquify";
          },
          redo: () => {
            render();
            closeTexture();
            return "brush";
          },
        });

        historyManager.addUndo(newHistory);
      }

      closeTexture();

      sourceImageDirty = null;
    },
    setSize,
    displacementTex: displacementTexInput,
    displaceFBO: displaceInFBO,
  };

  return Liquify;
}

// 드로우 1 -> 드로우 2 -> 드로우 3 -> 나가기
//       이미지 1 -> 이미지 2 ->  이미지 3
// 드로우2 를 하기 전, start단에서 이미지 1 때의 imageDirty를 보관한다.
// 그리고 드로우 2를 수행하고, 이미지1 에서 Rect2에 해당되는 부분을 텍스쳐화 한다.
// 히스토리에 imageDirty와 Rect2와 텍스쳐를 넣는다.

export interface Snapshot {
  layerId;
  pixelReader?;
  rect;
  apply;
  selectionRect?;
}

export class HistoryObject {
  gl;
  tool;
  id;
  skip;

  constructor(gl, { undo, redo }) {
    this.gl = gl;
    this.undo = undo;
    this.redo = redo;

    // redoPixels에 Rect2에 해당하는 이미지2 텍스쳐 픽셀리더, redoimageDirty 저장.
    // 결과물을 올리느냐, 또는 pointers를 올리느냐. 그건 자기 입맛대로 하기
  }

  undo: () => string;

  redo: () => string;
}
let cacheIntegralEaseInOut: Float32Array | null = null;
let cacheIntegralEaseInOutMirror: Float32Array | null = null;

let integralBase64 =
    "AAAAP9n//z5k//8+ov7/PpL9/z40/P8+iPr/Po74/z5G9v8+sfP/Ps3w/z6c7f8+HOr/Pk7m/z4y4v8+yN3/PhDZ/z4J1P8+tM7/PhHJ/z4fw/8+3rz/Pk+2/z5xr/8+Raj/Psmg/z7/mP8+5ZD/Pn2I/z7Ff/8+vnb/Pmht/z7CY/8+zVn/PolP/z70RP8+EDr/Ptwu/z5YI/8+hBf/PmAL/z7r/v4+JvL+PhHl/j6r1/4+9cn+Pu27/j6Vrf4+7J7+PvGP/j6mgP4+CXH+Phth/j7bUP4+SUD+PmYv/j4xHv4+qgz+PtH6/T6l6P0+J9b9PlfD/T40sP0+vpz9PvaI/T7adP0+a2D9PqpL/T6UNv0+LCH9PnAL/T5g9fw+/N78PkTI/D44sfw+2Jn8PiSC/D4bavw+vVH8Pgs5/D4DIPw+pwb8Pvbs+z7v0vs+k7j7PuGd+z7agvs+fWf7PspL+z7BL/s+YRP7Pqz2+j6f2fo+Pbz6PoOe+j5zgPo+C2L6PkxD+j43JPo+yQT6PgTl+T7oxPk+c6T5PqeD+T6CYvk+BUH5PjAf+T4C/fg+fNr4Pp23+D5llPg+1HD4PulM+D6mKPg+CAT4PhLf9z7Bufc+F5T3PhJu9z60R/c++yD3Puj59j560vY+sqr2Po6C9j4QWvY+NzH2PgII9j5y3vU+h7T1PkCK9T6dX/U+njT1PkQJ9T6N3fQ+erH0PguF9D4/WPQ+Fiv0PpH98z6uz/M+b6HzPtJy8z7ZQ/M+gRTzPszk8j66tPI+SoTyPnxT8j5PIvI+xfDxPty+8T6VjPE+71nxPusm8T6I8/A+xr/wPqWL8D4lV/A+RiLwPgft7z5pt+8+a4HvPg5L7z5RFO8+M93uPral7j7Zbe4+mzXuPv387T7/w+0+oIrtPuBQ7T7AFu0+PtzsPlyh7D4YZuw+cyrsPm3u6z4Gsus+PXXrPhI46z6G+uo+mLzqPkh+6j6WP+o+ggDqPgzB6T4zgek++EDpPlsA6T5bv+g++X3oPjM86D4L+uc+gbfnPpN05z5CMec+ju3mPnep5j79ZOY+HyDmPt7a5T45leU+MU/lPsUI5T72weQ+wnrkPisz5D4w6+M+0aLjPg5a4z7nEOM+XMfiPm194j4ZM+I+YejhPkSd4T7EUeE+3gXhPpS54D7mbOA+0x/gPlvS3z5/hN8+PjbfPpjn3j6NmN4+HknePkn53T4Qqd0+cljdPm4H3T4Gttw+OWTcPgYS3D5vv9s+cmzbPhAZ2z5Jxdo+HXHaPowc2j6Vx9k+OnLZPnkc2T5Txtg+x2/YPtcY2D6Bwdc+xmnXPqYR1z4gudY+NmDWPuYG1j4xrdU+F1PVPpf41D6zndQ+aULUPrvm0z6nitM+Li7TPlDR0j4OdNI+ZhbSPlm40T7oWdE+EfvQPtab0D42PNA+MtzPPsh7zz76Gs8+yLnOPjFYzj429s0+1pPNPhIxzT7qzcw+XWrMPm0GzD4Yoss+YD3LPkPYyj7Dcso+3wzKPpimyT7tP8k+3tjIPmxxyD6XCcg+X6HHPsQ4xz7Gz8Y+ZWbGPqH8xT56ksU+8ifFPge9xD65UcQ+CubDPvh5wz6FDcM+sKDCPnkzwj7hxcE+6FfBPo7pwD7SesA+tgvAPjmcvz5cLL8+Hry+PoBLvj6C2r0+JGm9Pmf3vD5Khbw+zhK8PvOfuz65LLs+ILm6PilFuj7T0Lk+IFy5Pg7nuD6fcbg+0vu3PqiFtz4hD7c+Ppi2Pv4gtj5hqbU+aTG1PhS5tD5kQLQ+WcezPvNNsz4y1LI+FlqyPqHfsT7RZLE+p+mwPiVusD5J8q8+FHavPob5rj6hfK4+Y/+tPs6BrT7iA60+noWsPgQHrD4UiKs+zQirPjGJqj5ACao++oipPl8IqT5vh6g+LAaoPpaEpz6sAqc+cICmPuH9pT4Ae6U+zfekPkp0pD518KM+UWyjPtznoj4YY6I+BN6hPqJYoT7y0qA+9EygPqnGnz4RQJ8+LLmePvwxnj6Aqp0+uSKdPqianD5MEpw+qImbProAmz6Ed5o+Bu6ZPkBkmT402pg+4k+YPknFlz5sOpc+Sq+WPuQjlj46mJU+TgyVPh+AlD6v85M+/maTPgzakj7bTJI+ar+RPrsxkT7Oo5A+pBWQPj2Hjz6b+I4+vWmOPqXajT5US40+ybuMPgYsjD4MnIs+2wuLPnN7ij7X6ok+BlqJPgHJiD7KN4g+YKaHPsYUhz77goY+APGFPtdehT5/zIQ++zmEPkungz5wFIM+aoGCPjvugT7kWoE+ZceAPsAzgD7sP38+Dhh+PunvfD6Ax3s+1J56Puh1eT69THg+VSN3PrT5dT7bz3Q+zaVzPox7cj4aUXE+eSZwPq37bj630G0+mqVsPll6az72Tmo+dCNpPtb3Zz4ezGY+T6BlPmx0ZD54SGM+dhxiPmjwYD5TxF8+OJhePhtsXT4AQFw+6RNbPtvnWT7Yu1g+449XPgJkVj42OFU+hQxUPvHgUj5/tVE+MopQPhBfTz4bNE4+WQlNPs7eSz5/tEo+b4pJPqVgSD4kN0c+8w1GPhflRD6VvEM+c5RCPrZsQT5mRUA+iR4/Pib4PT5D0jw+6qw7PiGIOj7yYzk+ZUA4PoYdNz5h+zU+Ado0Pni5Mz7bmTI+TXsxPt1dMD6JQS8+UyYuPjgMLT468ys+WNsqPpHEKT7nrig+V5onPuOGJj6JdCU+S2MkPiZTIz4cRCI+LDYhPlUpID6XHR8+8xIePmgJHT71ABw+mvkaPljzGT4t7hg+GeoXPh3nFj435RU+aOQUPrDkEz4N5hI+gOgRPgjsED6l8A8+V/YOPh79DT74BA0+5g0MPucXCz78Igo+Iy8JPlw8CD6oSgc+BVoGPnNqBT7zewQ+g44DPiOiAj7TtgE+kswAPsLG/z199v09VCj8PUdc+j1Wkvg9f8r2PcEE9T0cQfM9kH/xPRrA7z27Au49ckfsPT2O6j0c1+g9DiLnPRNv5T0pvuM9Tw/iPYVi4D3Kt949HQ/dPX5o2z3qw9k9YiHYPeSA1j1v4tQ9A0bTPZ+r0T1CE9A963zOPZjozD1KVss9/8XJPbY3yD1uq8Y9JiHFPd6Ywz2UEsI9R47APfcLvz2ii709Rw28PeaQuj1+Frk9DJ63PZIntj0Ms7Q9e0CzPd7PsT0yYbA9ePSuPa+JrT3UIKw96LmqPelUqT3W8ac9rpCmPXAxpT0b1KM9rniiPSgfoT2Hx589y3GePfIdnT38y5s953uaPbMtmT1d4Zc95ZaWPUpOlT2LB5Q9p8KSPZx/kT1pPpA9Dv+OPYjBjT3YhYw9+0uLPfETij243Yg9UKmHPbZ2hj3rRYU97BaEPbnpgj1QvoE9sZSAPbPZfj2SjXw9/ER6Pe7/dz1ovnU9ZYBzPeNFcT3hDm89XNtsPVCraj29fmg9n1VmPfMvZD24DWI96+5fPYnTXT2Qu1s9/qZZPc+VVz0CiFU9k31TPYF2UT3Ick89ZnJNPVl1Sz2fe0k9M4VHPRWSRT1BokM9tLVBPW3MPz1p5j09pAM8PR0kOj3QRzg9vG42Pd2YND0wxjI9tfYwPWYqLz1DYS09R5srPXLYKT2/GCg9LVwmPbiiJD1e7CI9HDkhPfCIHz3W2x09zTEcPdGKGj3g5hg990UXPROoFT0xDRQ9UHUSPWvgED2BTg89jr8NPZAzDD2Eqgo9ZyQJPTehBz3xIAY9kaMEPRYpAz18sQE9wTwAPcOV/Ty3t/o8V9/3PJ0M9TyFP/I8CXjvPCO27DzN+ek8AkPnPLyR5Dz15eE8qD/fPM+e3DxlA9o8Y23XPMXc1DyDUdI8msvPPAJLzTy2z8o8sVnIPO3oxTxkfcM8EBfBPOu1vjzwWbw8GQO6PGGxtzzAZLU8Mx2zPLLasDw5na48wWSsPEQxqjy9Aqg8JtmlPHm0ozyxlKE8x3mfPLVjnTx3Ups8BUaZPFs+lzxyO5U8RD2TPMxDkTwET4885V6NPGtzizyPjIk8TKqHPJrMhTx284M82B6CPLtOgDwzBn082nd5PF/ydTy2dXI81QFvPK+Wazw4NGg8ZdpkPCqJYTx7QF48TABbPJLIVzxAmVQ8S3JRPKdTTjxJPUs8JC9IPC0pRTxXK0I8mDU/PONHPDwsYjk8aIQ2PIuuMzyJ4DA8VhouPOZbKzwvpSg8I/YlPLZOIzzfriA8jxYePLyFGzxa/Bg8XXoWPLr/EzxjjBE8TyAPPHC7DDy7XQo8JQcIPKG3BTwkbwM8oi0BPB/m/TvBfvk7EiX1O/zY8Dtmmuw7OWnoO15F5Du+LuA7QCXcO80o2DtPOdQ7rVbQO9GAzDujt8g7DPvEO/NKwTtDp7075A+6O7+Etju7BbM7w5KvO78rrDuX0Kg7NYGlO4E9ojtlBZ87ydibO5a3mDu1oZU7D5eSO42XjzsZo4w7mrmJO/vahjskB4Q7/z2BO+j+fDvblnc7p0NyOyAFbTsY22c7YsViO9DDXTs11lg7ZfxTOzE2Tzttg0o77ONFO4BXQTv+3Tw7OHc4OwEjNDst4S87kLErO/yTJztFiCM7QI4fO7+lGzuXzhc7nAgUO6FTEDt6rww7/BsJO/uYBTtMJgI7g4f9OmTi9jriXPA6p/bpOl2v4zqtht06QnzXOsWP0TrhwMs6QQ/GOo56wDp1Ars6oaa1OrxmsDpyQqs6cDmmOmJLoTrzd5w60L6XOqYfkzoimo468S2KOsHahTo/oIE6M/x6Ovzncjo4A2s6Q01jOnvFWzo/a1Q67j1NOuc8RjqLZz86Or04OlQ9Mjo95ys6V7olOgO2Hzqn2Rk6pSQUOmSWDjpHLgk6tesDOimc/TmaqfM5jP7pOdCZ4Dk5etc5mZ7OOccFxjmZrr055pe1OYfArTlXJ6Y5MsueOfWqlzmAxZA5sxmKOW+mgzkx1Xo5KcpuOZIpYzk88Vc5/R5NOaqwQjkdpDg5NfcuOdGnJTnXsxw5LhkUOcHVCzmB5wM5vJj4OJ8E6jigDtw4ubLOOO7swThKubU44ROqOM34njgxZJQ4OlKKOBq/gDgfTm84vAxeOKiyTTiQOD44NZcvOGjHITgPwhQ4IYAIOFP1+TeQVeQ3XxPQN08hvTcacqs3ofiaN/SnizeX5no3IJxgN6xXSDfAADI3RH8dN4C7Cjc8PPM2XiDUNlv2tzb4kZ422seHNgfbZja+skI2hcUiNvPDBjYpwdw19Z+yNaCRjjWnD2A1bfEsNTq+AjXc6sA0LkGKNLZPPzQ5d/0z7eaeM29dOTOQ7sMyHoczMsY8gzFUGn4wucCzLg==";

let IntegralEaseInOutMirrorBase64 =
    "AAAAALBquzS+7mU2wjKANxTJQDhVqeU4IddqOdqp1zk45TY6seKROiOw3To16yE7h+tkO2lunTv1gtM7KTwLPHkaNDxkYGU8UxGQPF3DsjxxYds8iEcFPQx8ID1nqD896ipjPbGshT0aJpw9feK0Payxzz2SZew9GWkFPtVmFT4VGCY+AWo3PslKST6tqVs+93ZuPv/RgD6RkYo+6nOUPkdznj5siqg+orSyPrntvD4GMsc+ZH7RPjfQ2z5kJeY+XHzwPhDU+j74lQI/0sEHP07tDD/lFxI/zkAXP/1mHD8kiSE/r6UmP8q6Kz9cxjA/C8Y1Pze3Oj8Blz8/QmJEP5UVST9OrU0/gCVSP/t5Vj9Lplo/uqVeP05zYj/LCWY/sGNpPz17bD9qSm8/Uc1xP3oFdD8/+HU/iKt3P/QkeT/laXo/dX97P35qfD+WL30/D9N9P/pYfj8jxX4/FBt/PxVefz8okX8/D7d/P0fSfz8L5X8/U/F/P9P4fz/9/H8/AP9/P8f/fz/6/38/AACAPw==";

function decodeBase64ToFloat32Array(base64) {
    const binary = atob(base64.replace(/\s+/g, ""));
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return new Float32Array(buffer.buffer);
}

/**
 * x가 0 이상 1 이하일 때,
 * I(x)= ∫₀¹ √((1-F(t))² - x²) dt 를 계산합니다.
 *
 **/
// F(x) = easeinoutCirc(x) 일 때
export async function getIntegralEaseInOut() {
   // console.log(edgeCutLookup())
   // return edgeCutLookup();
    // return new Float32Array([0.5,0.4,0.3,0.2,0.1,0]);
    if (cacheIntegralEaseInOut) {
        return cacheIntegralEaseInOut;
    }
    cacheIntegralEaseInOut = decodeBase64ToFloat32Array(integralBase64);

    return cacheIntegralEaseInOut;

    // const response1 = await fetch("/data.bin");
    // const arrayBuffer1 = await response1.arrayBuffer();
    // cacheIntegralEaseInOut = new Float32Array(arrayBuffer1);
    // return cacheIntegralEaseInOut;
}

function F(x) {
    return easeInOutSine(x)
}
function easeInOutSine(x: number): number {
return -(Math.cos(Math.PI * x) - 1) / 2;
}
const EDGE_GRID_SIZE = 20;          // x ∈ [0,1] 을 100등분
let edgeCutTable = null;             // 1‑차원 Float32Array (EDGE_GRID_SIZE)


/**
 * 단순 복합 사다리꼴 법칙으로 적분을 근사 계산합니다.
 * @param {Function} f    – t에 대한 함수
 * @param {number} a      – 하한
 * @param {number} b      – 상한
 * @param {number} steps  – 분할 수
 * @returns {number}
 */
function numericIntegrate(f, a, b, steps = 200) {
  if (b <= a) return 0;
  const h = (b - a) / steps;
  let sum = f(a) + f(b);
  for (let i = 1; i < steps; i++) {
    sum += 2 * f(a + i * h);
  }
  return (h / 2) * sum;
}

/* ----------  edgeCut 테이블 초기화 ---------- */
function initEdgeCutTable() {
  edgeCutTable = new Float32Array(EDGE_GRID_SIZE);

  for (let xi = 0; xi < EDGE_GRID_SIZE; xi++) {
    const x = xi / (EDGE_GRID_SIZE - 1);            // x ∈ [0,1]
    const upper = Math.sqrt(1 - x * x);             // √(1 - x²)
    edgeCutTable[xi] = numericIntegrate(
      t => F(1 - Math.hypot(x, t)),                 // F(1 - √(x² + t²))
      0,
      upper
    );
  }
}

/* ----------  edgeCut 값 조회 ---------- */
/**
 * edgeCutLookup(x)  →  ∫₀^(√(1-x²)) F(1-√(x²+t²)) dt
 * @param {number} x  0 ≤ x ≤ 1
 * @returns {number}
 */
function edgeCutLookup() {
  if (!edgeCutTable) initEdgeCutTable();

  return edgeCutTable;
}

/* ----------  사용 예시 ---------- */
// console.log(edgeCutLookup(0.0));   // x = 0  →  최대 적분 범위
// console.log(edgeCutLookup(0.7));   // x = 0.7

/**
 * F(x)를 뒤집어놓은 함수의 적분 0~x까지 가져옴
 */
export async function getIntegralEaseInOutMirror() {
    if (cacheIntegralEaseInOutMirror) {
        return cacheIntegralEaseInOutMirror;
    }
    cacheIntegralEaseInOutMirror = decodeBase64ToFloat32Array(
        IntegralEaseInOutMirrorBase64,
    );
    return cacheIntegralEaseInOutMirror;

    // const response2 = await fetch("/integralEase.bin");
    // const arrayBuffer2 = await response2.arrayBuffer();
    // cacheIntegralEaseInOutMirror = new Float32Array(arrayBuffer2);
    // return cacheIntegralEaseInOutMirror;
}
import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { getBufferManager, getFullQuadShader } from "../vertexShader";
import { getManager } from "../utils/cachedManager";
import { DirtyRect, Rect } from "../utils/dirtyRect";
import { getHistoryManager } from "../history/history";
import { HistoryObject } from "./liquify";

export function getBrushManager(canvas, gl) {
  const manager = getManager(gl, "brushManager", () =>
    makeBrushManager(canvas, gl),
  );
  return manager;
}

function makeBrushManager(canvas, gl) {
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    console.error("EXT_color_buffer_float not supported!");
  }
  const extFloatLinear =
    gl.getExtension("OES_texture_float_linear") ||
    gl.getExtension("EXT_texture_filter_float");
  if (!extFloatLinear) {
    console.error(
      "This device does not support linear filtering for float textures.",
    );
  }

  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);
  const bufferManager = getBufferManager(canvas, gl);

  let strokeShaderSource = `#version 300 es
    precision mediump float;
    
    // 현재까지 그려진 알파 채널이 담긴 텍스처
    uniform sampler2D u_pathMap;
    
    // 선분 정보와 브러시 특성
    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_radius;
    uniform float u_alpha;
    
    // 화면 해상도 (텍스처 좌표 → 픽셀 좌표 변환)
    uniform vec2 u_resolution;
    
    // 메인 텍스 좌표 & 출력
    in vec2 v_texCoord;
    out float outAlpha;
    
    // 16샘플(2×2) 오프셋
    const vec2 sampleOffsets[16] = vec2[](
        vec2(-0.375, -0.375), vec2(-0.125, -0.375), vec2(0.125, -0.375), vec2(0.375, -0.375),
        vec2(-0.375, -0.125), vec2(-0.125, -0.125), vec2(0.125, -0.125), vec2(0.375, -0.125),
        vec2(-0.375,  0.125), vec2(-0.125,  0.125), vec2(0.125,  0.125), vec2(0.375,  0.125),
        vec2(-0.375,  0.375), vec2(-0.125,  0.375), vec2(0.125,  0.375), vec2(0.375,  0.375)
    );
    
    // 픽셀(또는 샘플)과 선분 사이의 최단거리 구하기
    float distanceToSegment(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a;
        float abLen2 = dot(ab, ab); // 선분 길이^2
        if(abLen2 < 0.000001) {
            // 선분이 거의 점에 가깝다면, 그냥 a와의 거리
            return length(p - a);
        }
        // 투영 비율 t
        float t = dot(p - a, ab) / abLen2;
        t = clamp(t, 0.0, 1.0);
        // 선분 위의 최근접 점
        vec2 closest = a + ab * t;
        return distance(p, closest);
    }
    
    void main() {
        // (1) 현재 픽셀에서 기존 알파값
        float basicAlpha = texture(u_pathMap, v_texCoord).r;
    
        // (2) 픽셀 중심 좌표 (픽셀 단위)
        vec2 pixelCoord = v_texCoord * u_resolution;
    
        // (3) 이 픽셀 중심 ~ 선분 거리
        float distCenter = distanceToSegment(pixelCoord, u_start, u_end);
    
        // 내부/외부 빠른 판정용 범위
        float inner = u_radius - 1.0;
        float outer = u_radius + 1.0;
    
        float finalAlpha;
    
        // (A) 완전 내부: 알파 100%
        if(distCenter < inner) {
            finalAlpha = u_alpha;
        }
        // (B) 완전 외부: 알파 0%
        else if(distCenter > outer) {
            finalAlpha = 0.0;
        }
        // (C) 경계 영역 16샘플 수동 SSAA
        else {
            float coverage = 0.0;
    
            // 16번 샘플링
            for(int i = 0; i < 16; i++) {
                vec2 offset = sampleOffsets[i];
                vec2 sampleCoord = pixelCoord + offset;
                float distSample = distanceToSegment(sampleCoord, u_start, u_end);
                if(distSample < u_radius) {
                    coverage += 1.0;
                }
            }
            // 16샘플 평균 → [0..1] 커버리지
            coverage /= 16.0;
            
            // 최종 알파
            finalAlpha = coverage * u_alpha;
        }
    
        // (4) 기존 알파(basicAlpha)와 비교해 더 큰 값 적용
        outAlpha = max(basicAlpha, finalAlpha);
    }
    
    `;
  let strokeShader = createShader(gl, gl.FRAGMENT_SHADER, strokeShaderSource);

  let strokeProgram = createProgram(gl, fullQuadVertexShader, strokeShader);
  gl.useProgram(strokeProgram);

  // 알파맵 텍스처 생성 및 데이터 업로드
  let pathTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
  gl.bindTexture(gl.TEXTURE_2D, pathTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.uniform1i(
    gl.getUniformLocation(strokeProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  // 출력용 텍스처 생성
  let pathTexOut = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, pathTexOut);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 프레임버퍼 생성 및 바인딩
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pathTexOut,
    0,
  );

  // 쓰여진 결과를 blit으로 기본 변위맵에 업로드 하기 위해서
  let readFrameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
  gl.framebufferTexture2D(
    // 당장 안쓰더라도 바인딩 해놓으면 내부에서 자체 최적화 되나?
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pathTexOut,
    0,
  );

  bufferManager.createFullQuadVAO(strokeProgram);

  //////////////////////////

  //////////////////////////
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  let brushShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;
      uniform vec3 u_color; // 원하는 색

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
       float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 brushColor = vec4(u_color, value); // 새로운 색
        vec4 imageColor = texture(u_source, v_texCoord); // 기존 이미지 색

       // Premultiplied Alpha 적용
        vec3 premultBrush = brushColor.rgb * brushColor.a; // RGB에 알파를 미리 곱함
        vec3 premultImage = imageColor.rgb;

        // 블렌딩 (Premultiplied 방식)
        vec3 blendedRGB = premultImage * (1.0 - brushColor.a) + premultBrush;
        float blendedAlpha = imageColor.a + brushColor.a * (1.0 - imageColor.a); 

        // 최종 색상
        outColor = vec4(blendedRGB, blendedAlpha);
      }
      `;

  let brushShader = createShader(gl, gl.FRAGMENT_SHADER, brushShaderSource);
  let brushProgram = createProgram(gl, fullQuadVertexShader, brushShader);
  gl.useProgram(brushProgram);

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(brushProgram);

  ///////////////////////////////////////
  let eraserShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_source, v_texCoord); // 기존 이미지 색

        float factor = 1.0 - value;
        outColor = vec4(imageColor.rgb * factor, imageColor.a * factor);
      }
      `;

  let eraserShader = createShader(gl, gl.FRAGMENT_SHADER, eraserShaderSource);
  let eraserProgram = createProgram(gl, fullQuadVertexShader, eraserShader);
  gl.useProgram(eraserProgram);

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(eraserProgram);

  //////////////////////

  let pathDirty = new DirtyRect();

  ///////////

  function setSize() {
    let width = paintOptions.width;
    let height = paintOptions.height;

    //console.log(paintOptions);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    gl.useProgram(strokeProgram);
    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_resolution"),
      width,
      height,
    );

    gl.useProgram(brushProgram);
    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_resolution"),
      width,
      height,
    );
    gl.useProgram(eraserProgram);
    gl.uniform2f(
      gl.getUniformLocation(eraserProgram, "u_resolution"),
      width,
      height,
    );

    // 알파맵 텍스처 데이터 업로드
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);

    // 0으로 초기화
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );

    // 출력용 텍스처
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, pathTexOut);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );

    clearMap();
  }

  setSize();

  let layerManager = getLayerManager(canvas, gl);

  let renderingManager = getRenderingManager(canvas, gl);
  function clearMap() {
    let glHelper = getGlHelper(gl);
    glHelper.clearTexture(pathTex, paintOptions.width, paintOptions.height, 0);
  }

  let scissorDirty = new DirtyRect();

  let brushManager = {
    enter() {
     // console.log("enter!");
    },
    start(pointer) {
     // console.log("start!");

      pathDirty.reset(pointer, paintOptions.radius);
    },
    stroke(start, end) {
      gl.useProgram(strokeProgram);

      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
      gl.bindTexture(gl.TEXTURE_2D, pathTex);

      // 유나폼 변수 설정
      gl.uniform1f(
        gl.getUniformLocation(strokeProgram, "u_radius"),
        paintOptions.radius,
      );
      gl.uniform1f(
        gl.getUniformLocation(strokeProgram, "u_alpha"),
        paintOptions.alpha,
      );

      gl.uniform2f(
        gl.getUniformLocation(strokeProgram, "u_start"),
        start.x,
        start.y,
      );
      gl.uniform2f(gl.getUniformLocation(strokeProgram, "u_end"), end.x, end.y);

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      // 프레임버퍼에 쓰기 텍스처 넣기
      // 이전에 blit할때 다른거 지정되어있었음
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTexOut,
        0,
      );

      scissorDirty.reset(start, paintOptions.radius);
      scissorDirty.updatePointer(start, paintOptions.radius);
      scissorDirty.updatePointer(end, paintOptions.radius);

      pathDirty.updatePointer(start, paintOptions.radius);
      pathDirty.updatePointer(end, paintOptions.radius);

      // SCISSOR TEST로 일부만 렌더링
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorDirty.x,
        scissorDirty.y,
        scissorDirty.width,
        scissorDirty.height,
      );
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 적용된 텍스처를 read에도 옮기기
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

      gl.framebufferTexture2D(
        gl.READ_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTexOut,
        0,
      );

      gl.framebufferTexture2D(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTex,
        0,
      );

      gl.blitFramebuffer(
        scissorDirty.x,
        scissorDirty.y,
        scissorDirty.ex + 1,
        scissorDirty.ey + 1, // 소스
        scissorDirty.x,
        scissorDirty.y,
        scissorDirty.ex + 1,
        scissorDirty.ey + 1, // 대상
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
    },
    brush() {
      gl.useProgram(brushProgram);

      gl.uniform3fv(
        gl.getUniformLocation(brushProgram, "u_color"),
        paintOptions.color,
      );
      // 쓰기 영역: 내 화면
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(Rect.copy(scissorDirty));
    },
    eraser() {
      gl.useProgram(eraserProgram);
      // 쓰기 영역: 내 화면
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(Rect.copy(scissorDirty));
    },
    end() {
      let { before, after } = sourceTextureManager.upload(
        pathDirty.x,
        pathDirty.y,
        pathDirty.width,
        pathDirty.height,
      );

      const newHistory = new HistoryObject(gl, {
        undo: () => {
          before.apply();
          renderingManager.render();
          return "brush";
        },
        redo: () => {
          after.apply();
          renderingManager.render();
          return "brush";
        },
      });

      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
      clearMap();
    },
    cancel() {
      sourceTextureManager.restore();
      clearMap();
      renderingManager.render();
    },
    exit() {},
    setSize,
  };

  return brushManager;
}
import { PixelReader } from "./PixelReader";

let drawing = false;
export function setDrawingFlag(value) {
  drawing = value;
}

let readPixelQueue: PixelReadProcessor;

export function pushReadPixelQueue(gl, pixelReader: PixelReader) {
  if (!readPixelQueue) {
    readPixelQueue = new PixelReadProcessor(gl);
  }

  readPixelQueue.push(pixelReader);
}

export class PixelReadProcessor {
  gl: WebGL2RenderingContext;
  readPixelStack: PixelReader[] = []; // 최신 변경사항을 접근할 일이 많으니 LIFO로

  running = false;
  constructor(gl) {
    this.gl = gl;
  }

  push(pixelReader: PixelReader) {
    setDrawingFlag(false);
    this.readPixelStack.push(pixelReader);
    this.excute();
  }

  async excute() {
    if (this.running) return;
    this.running = true;

    while (this.readPixelStack.length > 0) {
      if (!drawing) {
        const pixelReader = this.readPixelStack.pop();

        while (!pixelReader.isEmpty()) {
          await waitForSync(this.gl);
          if (pixelReader.isEmpty()) break;

          const fn = pixelReader.front();
          fn();
          
          pixelReader.pop();
        }
      } else {
        await new Promise((r) => setTimeout(r, 32));
      }
    }

    this.running = false;
  }
}

async function waitForSync(gl) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();

  while (true) {
    const status = gl.clientWaitSync(sync, 0, 0); // timeout 무조건 0
    // console.log("while:", status);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      break;
    }
    // GPU가 아직 안 끝났으면, CPU는 양보
    await new Promise((r) => setTimeout(r, 0));
  }
  gl.deleteSync(sync);
}
import { getSourceTextureManager, paintOptions } from "../texture";
import { getManager } from "../utils/cachedManager";
import { DirtyRect, Rect } from "../utils/dirtyRect";
import { PixelReadProcessor, setDrawingFlag } from "./pixelReadProcessor";
import { PixelReader } from "./PixelReader";
import { mainThread } from "../../worker/mainPool";
import { HistoryObject } from "../tool/liquify";

export interface HistoryItem {
  group?: string;
  layerId: number;
  tool: string;
  rect?: DirtyRect;
  pixelReader?: PixelReader;
  skipHistory: boolean;
  applyHistory(HistoryItem): HistoryItem;
  showSelection?: boolean;
  selectionRect?: Rect;
}
let undoStack: HistoryObject[] = [];
let redoStack: HistoryObject[] = [];

export function resetHisory() {
  undoStack = [];
  redoStack = [];
  mainThread.historyCount(undoStack.length, redoStack.length);
}

export function getHistoryManager(canvas, gl) {
  const manager = getManager(gl, "history", () =>
    createHistoryManager(canvas, gl),
  );
  return manager;
}

function createHistoryManager(canvas, gl) {
  // 2. FBO 설정
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  //const readPixelQueue = new PixelReadProcessor(gl);

  function addUndo(
    newHistory: HistoryObject,
    options: {
      resetRedo?: boolean;
    } = {},
  ) {
    const { resetRedo = true } = options;

    //console.log("addUndo:", newHistory.tool);

    undoStack.push(newHistory);

    if (resetRedo && redoStack.length != 0) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
    }

    mainThread.historyCount(undoStack.length, redoStack.length);

    logCurrent();
  }

  function addRedo(newHistory: HistoryObject) {
    //console.log("addRedo:", newHistory.tool);

    redoStack.push(newHistory);

    mainThread.historyCount(undoStack.length, redoStack.length);
    logCurrent();
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    undoStack.pop();

    let response = history.undo();
    addRedo(history);

    return response;
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    let response = history.redo();
    addUndo(history, { resetRedo: false });

    return response;
  }

  function logCurrent() {
    console.log(
      "undo:",
      undoStack.length,
      "redo:",
      redoStack.length,
      // "\n",
      // "undoStack:",
      // undoStack,
      // "redoStack:",
      // redoStack,
    );
  }
  return {
    addUndo,
    undo,
    redo,
  };
}
/* ---------- 상수 ---------- */
const TILE_SIZE = 512 * 2; // 한 타일의 폭·높이(px)
const PACK_ALIGNMENT = 1; // 행 정렬을 1바이트로 맞춰 안전 확보

/* ---------- PixelReader ---------- */
export class PixelReader {
  pixelData: Uint8Array | Uint16Array | Float32Array;
  private static fbo: WebGLFramebuffer;
  private workQueue: (() => void)[] = [];

  constructor(
    private gl: WebGL2RenderingContext,
    private width: number,
    private height: number,
    private texture: WebGLTexture,
    private format: number, // gl.RGBA 등
    private type: number, // gl.UNSIGNED_BYTE 등
  ) {
    /* 1) 대상 버퍼 준비 ---------------------------------------------------- */
    const { components, TypedArray } = getPixelFormatInfo(gl, format, type);
    this.pixelData = new TypedArray(width * height * components);

    /* 2) FBO(재사용) 준비 -------------------------------------------------- */
    if (!PixelReader.fbo) {
      PixelReader.fbo = gl.createFramebuffer()!;
    }

    /* 3) 타일 단위 작업 생성 ---------------------------------------------- */
    this.enqueueTiles();
  }

  /* 타일별 readPixels 작업을 큐에 적재 */
  private enqueueTiles() {
    const { gl, width, height, texture, format, type } = this;
    const fbo = PixelReader.fbo;

    /* 가로·세로 타일 개수(끝 타일은 자투리) */
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesY = Math.ceil(height / TILE_SIZE);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        /* 타일 위치·크기 계산 --------------------------------------------- */
        const tileX = tx * TILE_SIZE;
        const tileY = ty * TILE_SIZE;
        const tileW = Math.min(TILE_SIZE, width - tileX);
        const tileH = Math.min(TILE_SIZE, height - tileY);

        /* 실제 readPixels 호출 람다 -------------------------------------- */
        this.workQueue.push(() => {
          const start = performance.now();

          /* FBO 바인딩 후 대상 텍스처 연결 */
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(
            gl.READ_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
          );

          /* --- PACK 스토어 설정 (타일 → 전체 버퍼 정확 위치) ------------- */
          gl.pixelStorei(gl.PACK_ALIGNMENT, PACK_ALIGNMENT); // 1바이트 정렬
          gl.pixelStorei(gl.PACK_ROW_LENGTH, width); // 한 행 전체 픽셀 수
          gl.pixelStorei(gl.PACK_SKIP_ROWS, tileY); // 행 오프셋
          gl.pixelStorei(gl.PACK_SKIP_PIXELS, tileX); // 열 오프셋

          /* 타일 읽기 – 결과는 pixelData의 정확 위치로 직행 -------------- */
          gl.readPixels(
            tileX,
            tileY,
            tileW,
            tileH,
            format,
            type,
            this.pixelData,
          );

          /* 상태 복원 (다른 코드에 영향 방지) ----------------------------- */
          gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
          gl.pixelStorei(gl.PACK_SKIP_ROWS, 0);
          gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);

          const end = performance.now();
          //console.log(`read tile (${tx},${ty}) size ${tileW}×${tileH}`);
          //console.log("read!", end - start);
        });
      }
    }

    /* 마지막에 정리 작업 */
    this.workQueue.push(() => {
      gl.deleteTexture(texture);
    });
  }

  /* ---------- 퍼블릭 API ---------- */
  isEmpty() {
    return this.workQueue.length === 0;
  }
  front() {
    return this.workQueue[0];
  }
  pop() {
    this.workQueue.shift();
  }

  /** 큐의 모든 readPixels를 순차 실행 후 픽셀 버퍼 반환 */
  getPixelData() {
    while (!this.isEmpty()) {
      const job = this.front();
      job();
      this.pop();
    }
    return this.pixelData;
  }
}

// WebGL pixel format/type 헬퍼
function getPixelFormatInfo(
  gl: WebGL2RenderingContext,
  format: number,
  type: number,
) {
  let components = 4; // default: RGBA
  switch (format) {
    case gl.RED:
      components = 1;
      break;
    case gl.RG:
      components = 2;
      break;
    case gl.RGB:
      components = 3;
      break;
    case gl.RGBA:
      components = 4;
      break;
    default:
      console.warn("Unknown format, defaulting components to 4 (RGBA)");
  }

  let bytesPerComponent = 1;
  let TypedArray: typeof Uint8Array | typeof Uint16Array | typeof Float32Array =
    Uint8Array;

  switch (type) {
    case gl.UNSIGNED_BYTE:
      bytesPerComponent = 1;
      TypedArray = Uint8Array;
      break;
    case gl.HALF_FLOAT:
      bytesPerComponent = 2;
      TypedArray = Uint16Array;
      break;
    case gl.FLOAT:
      bytesPerComponent = 4;
      TypedArray = Float32Array;
      break;
    default:
      console.warn("Unknown type, defaulting to UNSIGNED_BYTE");
  }

  const bytesPerPixel = components * bytesPerComponent;

  return {
    components,
    bytesPerComponent,
    bytesPerPixel,
    TypedArray,
  };
}
