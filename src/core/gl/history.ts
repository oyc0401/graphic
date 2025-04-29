import { getSourceTextureManager, paintOptions } from "./texture";
import { getManager } from "./utils/cachedManager";
import { getBrushManager } from "./tool/brushTool";
import { DirtyRect } from "./utils/dirtyRect";
interface HistoryItem {
  layerId: number;
  tool: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  pixelData: Uint8Array; // pixelData는 보통 readPixels 결과라서 Uint8Array로 추정
}
let undoStack: HistoryItem[] = [];
let redoStack: HistoryItem[] = [];

let pendingHistoryQueue = [];
let runQueue = false;
let drawing = false;
export function setQueueDrawingFlag(value) {
  drawing = value;
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

async function runPendingHistoryQueue(gl) {
  if (runQueue) return;
  runQueue = true;
  while (pendingHistoryQueue.length > 0) {
    // 읽고 나서 다음 작업으로 넘어가기 전에 잠시 대기

    if (!drawing) {
      await waitForSync(gl);
      const task = pendingHistoryQueue.shift();
      await task();
    } else {
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

const bytesPerPixel = 4;
const chunkPixels = 2000_000;

function createHistoryManager(canvas, gl) {
  // 2. FBO 설정
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  async function addUndo(
    historyType,
    historyTex,
    x,
    y,
    width,
    height,
    resetRedo = true,
  ) {
    const { layerId } = paintOptions;
    const totalPixels = width * height;
    const totalBytes = totalPixels * bytesPerPixel;

    let now = performance.now();
    // console.log("addUndo readPixels", width, height);

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
          historyTex,
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
      //console.log("getBufferSubData 완료!", now);
      const newHistory = {
        layerId,
        tool: historyType,
        rect: { x, y, width, height, ex: width + x - 1, ey: height + y - 1 },
        pixelData,
      };
      undoStack.push(newHistory);
      console.log("undo 추가");
      console.log("undo:", undoStack.length, "redo:", redoStack.length);

      gl.deleteTexture(historyTex); // 텍스처 삭제
    };

    pendingHistoryQueue.push(finish);
    //console.log("큐에 다넣음!", now);

    runPendingHistoryQueue(gl);

    if (resetRedo) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
      console.log("redo 초기화");
      console.log("undo:", undoStack.length, "redo:", redoStack.length);
    }
  }

  async function addRedo(historyType, historyTex, x, y, width, height) {
    const { layerId } = paintOptions;
    const totalPixels = width * height;
    const totalBytes = totalPixels * bytesPerPixel;

    let now = performance.now();
    console.log("addRedo readPixels", width, height);

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
          historyTex,
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
      //console.log("getBufferSubData 완료!", now);
      const newHistory = {
        layerId,
        tool: historyType,
        rect: { x, y, width, height, ex: width + x - 1, ey: height + y - 1 },
        pixelData,
      };
      redoStack.push(newHistory);
      console.log("redo 추가");
      console.log("undo:", undoStack.length, "redo:", redoStack.length);

      gl.deleteTexture(historyTex); // 텍스처 삭제
    };

    pendingHistoryQueue.push(finish);
    //console.log("큐에 다넣음!", now);

    runPendingHistoryQueue(gl);
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    let redoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      redoTex = sourceManager.applyHistory(history);
    }

    undoStack.pop();

    console.log("undo 실행");
    console.log("undo:", undoStack.length, "redo:", redoStack.length);
    let { x, y, width, height } = history.rect;
    addRedo(history.tool, redoTex, x, y, width, height);
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    let undoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      undoTex = sourceManager.applyHistory(history);
    }

    redoStack.pop();
    console.log("redo 실행");
    console.log("undo:", undoStack.length, "redo:", redoStack.length);

    let { x, y, width, height } = history.rect;
    addUndo(history.tool, undoTex, x, y, width, height, false);
  }
  return {
    addUndo,
    undo,
    redo,
  };
}
