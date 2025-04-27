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
let drawing = false;
export function setQueueDrawingFlag(value) {
  drawing = value;
}
async function runPendingHistoryQueue(gl) {
  if (runQueue) return;
  runQueue = true;
  while (pendingHistoryQueue.length > 0) {
    // 읽고 나서 다음 작업으로 넘어가기 전에 잠시 대기
   
    if (!drawing) {
      await waitForSync(gl);
      const task = pendingHistoryQueue.shift();
      await task();
    }else{
       await new Promise((r) => setTimeout(r, 32));
    }
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
    // console.log("while:", status);
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

  // 2. FBO 설정
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  async function addUndo() {
    const { width, height, layerId } = paintOptions;
    const totalPixels = width * height;
    const bytesPerPixel = 4;
    const chunkPixels = 2000_000;
    const totalBytes = totalPixels * bytesPerPixel;

    let now = performance.now();
    console.log("addUndo readPixels", width, height);
    console.log("undoStart!", now);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, texture);
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
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.blitFramebuffer(
      0,
      0,
      width,
      height, // 읽기 버퍼의 영역 (화면 영역)
      0,
      0,
      width,
      height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    const pixelData = new Uint8Array(totalBytes);

    // 한 줄씩 읽어서 처리
    const rowsPerChunk = Math.floor(chunkPixels / width); // 한 번에 읽을 수 있는 줄 수 (9999 / 1000 = 9줄)

    for (let rowOffset = 0; rowOffset < height; rowOffset += rowsPerChunk) {
      let chunk = () => {
        const remainingRows = height - rowOffset;
        const rowsToRead = Math.min(rowsPerChunk, remainingRows);

        const subArray = new Uint8Array(
          pixelData.buffer,
          rowOffset * width * bytesPerPixel,
          rowsToRead * width * bytesPerPixel,
        );

        // 한 줄씩 읽기
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.READ_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0,
        );
        gl.readPixels(
          0,
          rowOffset,
          width,
          rowsToRead,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          subArray,
        );
        //console.log("read!", rowOffset, now);
      };

      pendingHistoryQueue.push(chunk);
    }

    let finish = () => {
      console.log("getBufferSubData 완료!", now);

      const newHistory = {
        layerId,
        tool: "brush",
        width,
        height,
        pixelData,
      };
      historyStack.push(currentHistory);
      currentHistory = newHistory;

      gl.deleteTexture(texture); // 텍스처 삭제
    };

    pendingHistoryQueue.push(finish);
    console.log("큐에 다넣음!", now);

    runPendingHistoryQueue(gl);
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
