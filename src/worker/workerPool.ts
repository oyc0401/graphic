import * as Comlink from "comlink";
import { workerApi } from "./paintController";
import { encode,decode } from 'fast-png';
import WorkerModule from "./worker?worker";

type WorkerApi = typeof workerApi;

interface WorkerPool {
  [key: string]: {
    worker: Worker;
    workerApi: Comlink.Remote<WorkerApi>;
  };
}
const workerPool: WorkerPool = {};

export async function copyPixelsToClipboard(
  pixels: Uint8Array,
  width: number,
  height: number,
) {
  // 1. PNG 인코딩 (비프리멀티플라이드 알파 그대로)
  const pngData = encode({
    width,
    height,
    data: pixels, // RGBA 순서
  });

  // 2. Blob 생성
  const blob = new Blob([pngData], { type: "image/png" });
   // decodePNG(blob);
  // 3. ClipboardItem 생성 후 클립보드에 복사
  const item = new ClipboardItem({ "image/png": blob });
  await navigator.clipboard.write([item]);
}

export async function blobToUint8Array(blob: Blob){
  const arrayBuffer = await blob.arrayBuffer();
 let array = new Uint8Array(arrayBuffer);
  console.log(array)
}

export async function decodePNG(blob: Blob)  {
  const arrayBuffer = await blob.arrayBuffer();
  const png = decode(new Uint8Array(arrayBuffer));

let d =  {
    width: png.width,
    height: png.height,
    pixels: png.data, // RGBA 포맷
  };

  console.log(d);
}
function getWorkerObject() {
  if (!workerPool["layer"]) {
    const worker = new WorkerModule();

    // 워커가 postMessage 한 거 수신
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "copy") {
        let { pixels, width, height } = payload;
        let pixelData: Uint8Array = pixels;
        copyPixelsToClipboard(pixelData, width, height);
      }
    };
    const api = Comlink.wrap<WorkerApi>(worker);

    workerPool["layer"] = { worker, workerApi: api };
  }
  return workerPool["layer"];
}

export function getLayerWorker() {
  return getWorkerObject().workerApi;
}

async function downloadImage(blob, filename = "image.png") {
  const url = URL.createObjectURL(blob); // Blob을 임시 URL로 변환

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a); // DOM에 추가 후 클릭
  a.click();
  document.body.removeChild(a); // 사용 후 정리

  URL.revokeObjectURL(url); // 메모리 해제
}
