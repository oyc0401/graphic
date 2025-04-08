import { els } from "./elements";
import { getLayerWorker } from "./worker/workerPool";
//import { encode } from "fast-png";
import { encode } from "@jsquash/png";

import { cutSelection, makeSelectionFromBitmap, selection } from "./selection";
import { position, resizeScreen } from "./position";

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

          // 캔버스 크기 재설정하기.
          position.width = bitmap.width;
          position.height = bitmap.height;

          resizeScreen();

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
