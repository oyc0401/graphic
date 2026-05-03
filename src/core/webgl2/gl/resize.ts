import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getLayerManager } from "./layer";
import { getLiquifyManager } from "./tool/liquify/liquify";
import { getBrushManager } from "./tool/brush/brushTool";
import { getManager } from "../../utils/cachedManager";
import { getOffscreenManager, getRenderingManager } from "./render/render";
import {
  getHistoryManager,
  HistoryObject,
  Snapshot,
} from "../../history/history";
import { PixelStore } from "../../history/PixelStore";
import { getBitmapManager } from "../../canvas/bitmap";
import { Rect } from "@/core/utils/rect";

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
  const renderingManager = getRenderingManager(canvas, gl);

  sourceTextureManager.uploadFromLayer(paintOptions.layerId);

  renderingManager.render();

  // 바이트 크기 계산 (RGBA 4바이트, 이전 크기와 새 크기 두 개)
  const oldImageBytes = oldWidth * oldHeight * 4;
  const newImageBytes = newWidth * newHeight * 4;
  const byteSize = oldImageBytes + newImageBytes;

  const newHistory = new HistoryObject({
    undo: async () => {
      paintOptions.x -= x;
      paintOptions.y -= y;
      paintOptions.width = oldWidth;
      paintOptions.height = oldHeight;

      setToolSize();

      for (let snapshot of snapshots) {
        await snapshot.before.apply();
      }

      const sourceTextureManager = getSourceTextureManager(canvas, gl);

      //await lowQueue.finish();

      sourceTextureManager.uploadFromLayer(paintOptions.layerId);

      renderingManager.render();

      return {
        toolState: { tool: "brush" },
        position: {
          x: paintOptions.x,
          y: paintOptions.y,
          width: paintOptions.width,
          height: paintOptions.height,
        },
      };
    },
    redo: async () => {
      paintOptions.x += x;
      paintOptions.y += y;
      paintOptions.width = newWidth;
      paintOptions.height = newHeight;

      setToolSize();

      for (let snapshot of snapshots) {
        await snapshot.after.apply();
      }

      //await lowQueue.finish();

      sourceTextureManager.uploadFromLayer(paintOptions.layerId);

      renderingManager.render();

      return {
        toolState: { tool: "brush" },
        position: {
          x: paintOptions.x,
          y: paintOptions.y,
          width: paintOptions.width,
          height: paintOptions.height,
        },
      };
    },
    byteSize,
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
    const bitmapManager = getBitmapManager();
    const renderRect = Rect.fromWidth(0, 0, oldWidth, oldHeight);

    let pixelData = bitmapManager.copyDirtyRect(renderRect);

    let beforePixel = PixelStore.fromPixelData(
      pixelData,
      renderRect.width,
      renderRect.height,
    );

    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixel,
      rect: renderRect,

      async apply() {
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
          await this.pixelReader.getPixelData(),
        );

        bitmapManager.applyResizeDirtyRect(
          await beforePixel.getPixelData(true),
          renderRect.width,
          renderRect.height,
        );
      },
    };

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

    // layerTex에서 직접 픽셀 데이터 읽기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mainFBO);
    const afterPixels = new Uint8Array(newWidth * newHeight * 4); // RGBA, UNSIGNED_BYTE

    const sizeInBytes = afterPixels.byteLength;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `[Resize After] Pixel data size: (${sizeInMB} MB) - ${newWidth}x${newHeight}`,
    );

    gl.readPixels(
      0,
      0,
      newWidth,
      newHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      afterPixels,
    );

    const afterPixelReader = PixelStore.fromPixelData(
      afterPixels,
      newWidth,
      newHeight,
    );

    let newRect = Rect.fromWidth(0, 0, newWidth, newHeight);

    bitmapManager.applyResizeDirtyRect(
      afterPixelReader.getPixelData(true),
      newWidth,
      newHeight,
    );

    const afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: newRect,
      async apply() {
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
          await this.pixelReader.getPixelData(),
        );

        bitmapManager.applyResizeDirtyRect(
          afterPixelReader.getPixelData(true),
          newWidth,
          newHeight,
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

    let snapshots: {
      before: Snapshot;
      after: Snapshot;
    }[] = [];
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
