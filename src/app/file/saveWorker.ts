/** saveWorker.ts — 저장 전용 Web Worker.
 * 메인 스레드는 CPU 미러 스냅샷만 넘기고(transfer), 여기서
 * un-premultiply + Y-flip → PNG 인코딩 → IndexedDB 쓰기를 처리한다. */
import { encode } from "fast-png";
import { decodePremultAndFlip } from "@/core/utils/flipPixel";
import { putDrawing } from "./drawingStore";

export type SaveRequest = {
  seq: number;
  id: string;
  name: string;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  transparentBackground: boolean;
  updatedAt: number;
};

export type SaveResponse = { seq: number; ok: boolean };

self.onmessage = async (e: MessageEvent<SaveRequest>) => {
  const { seq, id, name, pixels, width, height, transparentBackground, updatedAt } =
    e.data;
  try {
    const decoded = decodePremultAndFlip(
      pixels as unknown as Uint8Array,
      width,
      height,
    );
    const pngData = encode({ width, height, data: decoded });
    await putDrawing({
      id,
      name,
      png: new Blob([pngData as BlobPart], { type: "image/png" }),
      width,
      height,
      transparentBackground,
      updatedAt,
    });
    self.postMessage({ seq, ok: true } satisfies SaveResponse);
  } catch (err) {
    console.error("저장 워커 실패:", err);
    self.postMessage({ seq, ok: false } satisfies SaveResponse);
  }
};
