/** file.ts */
import { els } from "../ui/elements";
import { getLayerWorker } from "../worker/workerPool";
import { encode } from "fast-png";
import * as Comlink from "comlink";
import {
  applySelection,
  cutSelection,
  makeSelectionFromBitmap,
  selection,
} from "../selection";
import {
  getPixelRatio,
  position,
  renderChangedPosition,
  setCameraPosition,
  setDefaultPosition,
} from "../position";
import { paintState, SessionId } from "../paintState";
import { toolManager } from "../tools/toolManager";
import { historyState, syncCoreState } from "../history";
import { documentState } from "../documentState";
import { getLetter } from "../i18n/language";
import {
  createDrawingId,
  getDrawing,
  type DrawingRecord,
} from "./drawingStore";
import { drawingPath } from "./initialRouteSession";

export function addClipboardEvent() {
  // 드래그가 영역 위로 올라왔을 때 기본 이벤트 방지
  els.container.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  // 실제 드롭이 발생했을 때
  els.container.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (paintState.getSessionId() !== null) return;

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

          if (historyState.getUndoCount() + historyState.getRedoCount() > 0) {
            makeSelectionFromBitmap(bitmap);
          } else {
            uploadImage(bitmap);
            startReplacedDrawing(stripExtension(file.name));
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
    if (paintState.getSessionId() !== null) {
      event.preventDefault();
      return;
    }

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

    // getAsFile()/preventDefault는 이벤트 디스패치 중 동기적으로 호출해야 한다.
    // await 이후엔 DataTransfer가 비활성화돼 두 번째 이미지의 getAsFile()이 null이 되고,
    // preventDefault()도 이미 늦어 기본 붙여넣기를 못 막는다. 먼저 동기로 파일을 모은다.
    const imageFiles: File[] = [];

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

      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) imageFiles.push(blob);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault(); // 기본 붙여넣기 막기 (await 전에 동기 호출)

    for (const blob of imageFiles) {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: "flipY",
        premultiplyAlpha: "premultiply",
      });

      console.log("onpaste 이미지 붙여넣기 실행!");
      if (historyState.getUndoCount() + historyState.getRedoCount() > 0) {
        makeSelectionFromBitmap(bitmap);
      } else {
        uploadImage(bitmap);
        startReplacedDrawing(getLetter("untitled"));
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
      let { pixels, width, height } = worker.getSelectionPixel();
      copyPixelsToClipboard(pixels, width, height);
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
      let { pixels, width, height } = worker.cut();
      copyPixelsToClipboard(pixels, width, height);
    }

    cutSelection();
  });
}

export function uploadImage(bitmap: ImageBitmap) {
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
  worker.uploadImage(
    bitmap,
    // Comlink.transfer(bitmap, [bitmap])
  );
  syncCoreState();

  renderChangedPosition();
}

export async function copyPixelsToClipboard(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = encode({ width, height, data: pixels });

  // 2. Blob 생성
  const blob = new Blob([pngData as BlobPart], { type: "image/png" });
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
    startReplacedDrawing(stripExtension(file.name));
  } catch (err) {
    console.error("파일 열기 실패:", err);
  }
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function resetImage() {
  toolManager.setBrushTool();

  setDefaultPosition();
  const worker = getLayerWorker();
  worker.resetImage(position.width, position.height);

  syncCoreState();
  renderChangedPosition();

  startNewDrawing();
}

/** 새 문서에 새 해시 id를 부여하고 URL에 반영한다. 저장 전엔 IndexedDB에 쓰지 않는다. */
function startNewDrawing() {
  documentState.setId(createDrawingId());
  documentState.setName(getLetter("untitled"));
  documentState.setLastSavedAt(null);
  documentState.setDirty(false);
  history.replaceState(null, "", drawingPath(documentState.getId()));
}

/** 캔버스가 다른 이미지로 통째로 교체되면(선택 붙여넣기 아님) 새 문서로 취급한다.
 * 기존 그림의 저장본은 건드리지 않고, 새 해시로 갈아탄다. */
function startReplacedDrawing(name: string) {
  documentState.setId(createDrawingId());
  documentState.setName(name.trim() || getLetter("untitled"));
  documentState.setLastSavedAt(null);
  history.replaceState(null, "", drawingPath(documentState.getId()));
}

export type LoadedDrawing = { record: DrawingRecord; bitmap: ImageBitmap };

/** 캔버스 부트 전에 URL의 그림 id로 저장본을 읽는다.
 * 비트맵을 초기 이미지 루트(tranferCanvas)에 태워 첫 렌더부터 그림이 보이게 한다 — 플리커 없음. */
export async function loadSavedDrawing(
  drawingId: string,
): Promise<LoadedDrawing | null> {
  try {
    const record = await getDrawing(drawingId);
    if (!record) return null;
    const bitmap = await createImageBitmap(record.png, {
      imageOrientation: "flipY",
      premultiplyAlpha: "premultiply",
    });
    return { record, bitmap };
  } catch (err) {
    console.error("그림 복원 실패:", err);
    return null;
  }
}

/** 부트 후 문서 메타(id·이름·저장 시각·배경 플래그)를 저장본/URL과 동기화한다. */
export function applyInitialDrawing(
  loaded: LoadedDrawing | null,
  routeDrawingId: string | null,
) {
  if (loaded) {
    const { record } = loaded;
    paintState.setTransparentBackground(record.transparentBackground);
    documentState.setId(record.id);
    documentState.setName(record.name);
    documentState.setLastSavedAt(record.updatedAt);
  } else {
    documentState.setId(routeDrawingId ?? createDrawingId());
    documentState.setName(getLetter("untitled"));
  }
  documentState.setDirty(false);
  syncDrawingUrl();
}

/** 현재 문서 id·세션 상태를 주소창에 반영한다.
 * ?tool=liquify|mosaic로 세션을 표현하고, ?img= 등 다른 쿼리와 해시는 보존한다. */
export function syncDrawingUrl() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = paintState.getSessionId();
  if (sessionId === SessionId.Liquify) params.set("tool", "liquify");
  else if (sessionId === SessionId.Mosaic) params.set("tool", "mosaic");
  else params.delete("tool");

  const query = params.toString();
  history.replaceState(
    null,
    "",
    `${drawingPath(documentState.getId())}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

let saveWorker: Worker | null = null;
let saveSeq = 0;
const pendingSaves = new Map<number, (ok: boolean) => void>();

function failAllPendingSaves() {
  for (const resolve of pendingSaves.values()) resolve(false);
  pendingSaves.clear();
}

function getSaveWorker(): Worker {
  if (!saveWorker) {
    saveWorker = new Worker(new URL("./saveWorker.ts", import.meta.url), {
      type: "module",
    });
    saveWorker.onmessage = (e: MessageEvent<{ seq: number; ok: boolean }>) => {
      pendingSaves.get(e.data.seq)?.(e.data.ok);
      pendingSaves.delete(e.data.seq);
    };
    // 워커 로드/직렬화 실패 시 저장이 영원히 pending으로 남으면
    // dirty가 클리어된 채 경고 없이 이탈할 수 있다 — 전부 실패 처리한다.
    saveWorker.onerror = failAllPendingSaves;
    saveWorker.onmessageerror = failAllPendingSaves;
  }
  return saveWorker;
}

/** 현재 캔버스를 PNG Blob으로 IndexedDB에 저장한다 (Ctrl+S / 저장 버튼).
 * 픽셀은 CPU 미러 사본이라 GL readback이 없고(알파 항상 보존),
 * 인코딩과 IndexedDB 쓰기는 전용 워커에서 처리한다. */
export async function saveDrawing() {
  const { pixels, width, height } = getLayerWorker().getCanvasBitmap();

  const updatedAt = Date.now();
  const seq = ++saveSeq;
  // 스냅샷은 이미 떴으므로 바로 클리어 — 이후의 스트로크가 다시 dirty로 만든다
  documentState.setDirty(false);

  const ok = await new Promise<boolean>((resolve) => {
    pendingSaves.set(seq, resolve);
    getSaveWorker().postMessage(
      {
        seq,
        id: documentState.getId(),
        name: documentState.getName(),
        pixels,
        width,
        height,
        transparentBackground: paintState.getTransparentBackground(),
        updatedAt,
      },
      [pixels.buffer],
    );
  });

  if (ok) {
    documentState.setLastSavedAt(updatedAt);
  } else {
    documentState.setDirty(true);
    console.error("그림 저장 실패");
  }
}

export async function downloadPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = encode({ width, height, data: pixels });

  // 2. Blob 생성
  const blob = new Blob([pngData as BlobPart], { type: "image/png" });

  // 3. 다운로드 링크 생성
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${documentState.getName() || "image"}.png`;

  // 4. 링크 클릭하여 다운로드 실행
  link.click();

  // 5. Blob URL 해제
  URL.revokeObjectURL(url);

  console.log("파일 다운로드 완료!!");
}

export function downloadImage() {
  let worker = getLayerWorker();
  let { pixels, width, height } = worker.downloadImage();
  downloadPixels(pixels, width, height);
}
