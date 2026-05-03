/** file.ts */
import { els } from "./ui/elements";
import { getLayerWorker } from "./worker/workerPool";
import { encode } from "fast-png";
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
import { syncCoreState } from "./history";

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

  syncCoreState();
  renderChangedPosition();
}

export async function downloadPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = encode({ width, height, data: pixels });

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
  let { pixels, width, height } = worker.downloadImage();
  downloadPixels(pixels, width, height);
}
