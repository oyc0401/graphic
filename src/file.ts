import { elementStore } from "./interface";
import { getLayerWorker } from "./worker/workerPool";
//import { encode } from "fast-png";
import { encode } from "@jsquash/png";

import { cutSelection, makeSelectionFromBitmap, selection } from "./selection";

export function addClipboardListener() {
  // 드래그가 영역 위로 올라왔을 때 기본 이벤트 방지
  elementStore.container.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  // 실제 드롭이 발생했을 때
  elementStore.container.addEventListener("drop", async (e) => {
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

          // 붙여넣기 로직 호출
          makeSelectionFromBitmap(bitmap);
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
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;

        const bitmap = await createImageBitmap(blob, {
          imageOrientation: "flipY",
          premultiplyAlpha: "premultiply",
        });

        if (bitmap) {
          console.log("onpaste 이미지 붙여넣기 실행!");
          makeSelectionFromBitmap(bitmap);
          event.preventDefault(); // 기본 동작 막기
        }
      }
    }
  });

  // 복사
  window.addEventListener("copy", (event: ClipboardEvent) => {
    event.preventDefault();
    if (selection.visiable) {
      let worker = getLayerWorker();
      worker.copy();
    }
  });

  // 잘라내기 = 복사와 동일, 나중에 cut 전용 로직 넣어도 됨
  window.addEventListener("cut", (event: ClipboardEvent) => {
    event.preventDefault();
    if (selection.visiable) {
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
