import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { enable_a_position, getFullQuadShader } from "../vertexShader";
import { getManager } from "../utils/cachedManager";
interface HistoryItem {
  layerId: number;
  tool: string;
  width: number;
  height: number;
  pixelData: Uint8Array; // pixelData는 보통 readPixels 결과라서 Uint8Array로 추정
}
let historyStack: HistoryItem[] = [];

let currentHistory;

let pendingHistoryQueue = [];
let runQueue = false;
async function runPendingHistoryQueue() {
  if (runQueue) return;
  runQueue = true;
  while (pendingHistoryQueue.length > 0) {
    const task = pendingHistoryQueue.shift();
    await task();
  }
  runQueue = false;
}

export function getHistoryManager(canvas, gl) {
  const manager = getManager(gl, "history", () =>
    createHistoryManager(canvas, gl),
  );
  return manager;
}
async function waitForSync(gl) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();

  while (true) {
    const status = gl.clientWaitSync(sync, 0, 0); // timeout 무조건 0
    console.log("while:", status);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      break;
    }
    // GPU가 아직 안 끝났으면, CPU는 양보
    await new Promise((r) => setTimeout(r, 0));
  }
  gl.deleteSync(sync);
}

function createHistoryManager(canvas, gl) {
  let layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);

  console.log("ALREADY_SIGNALED:", gl.ALREADY_SIGNALED);
  console.log("CONDITION_SATISFIED:", gl.CONDITION_SATISFIED);
  console.log("TIMEOUT_EXPIRED :", gl.TIMEOUT_EXPIRED);

  currentHistory = {
    layerId: paintOptions.layerId,
    tool: "brush",
    width: paintOptions.width,
    height: paintOptions.height,
    pixelData: null,
  };

  async function addUndo() {
    const { width, height, layerId } = paintOptions;
    const totalPixels = width * height;
    const bytesPerPixel = 4;
    const chunkPixels = 100_000;
    const chunkBytes = chunkPixels * bytesPerPixel;
    const totalBytes = totalPixels * bytesPerPixel;

    console.log("addUndo readPixels", width, height);

    // 1. PBO 생성
    const pbo = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, totalBytes, gl.STREAM_READ);

    // 2. 화면 → PBO 복사
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.flush();

    await waitForSync(gl);

    async function writeHistory() {
      const pixelData = new Uint8Array(totalBytes);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      // gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixelData); // 바로 다 읽기

      for (let offset = 0; offset < totalBytes; offset += chunkBytes) {
        await waitForSync(gl);
        //await waitForSync(gl);
        const size = Math.min(chunkBytes, totalBytes - offset);
        const subArray = new Uint8Array(pixelData.buffer, offset, size); // 얕은 복사

        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, offset, subArray);
        console.log("read!");
        await new Promise((r) => setTimeout(r, 0));
      }

      console.log("getBufferSubData 완료!");

      const newHistory = {
        layerId,
        tool: "brush",
        width,
        height,
        pixelData,
      };
      historyStack.push(currentHistory);
      currentHistory = newHistory;

      // 6. 정리
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(pbo);
    }

    pendingHistoryQueue.push(writeHistory);

    runPendingHistoryQueue();
  }

  function undo() {
    if (historyStack.length == 0) return;

    let history = historyStack[historyStack.length - 1];
    currentHistory = history;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerManager.getLayerTex(history.layerId));

    // pixelData를 texture에 다시 업로드
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      history.width,
      history.height,
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE,
      history.pixelData,
    );

    console.log("undo 성공!");
    sourceTextureManager.uploadCurrent();
    renderingManager.render();
    historyStack.pop();
  }

  return {
    addUndo,
    undo,
  };
}
