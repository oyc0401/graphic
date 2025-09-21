import { paintConfig } from "@/paint.config";
import {
  getHistoryManager,
  HistoryObject,
  Snapshot,
} from "../../../history/history";
import { PixelStore } from "../../../history/PixelStore";

import { getLayerManager } from "../layer";
import { getRenderingManager } from "../render/render";
import {
  getSourceTextureManager,
  paintOptions,
  TEXTURE_UNIT,
} from "../texture";
import { getManager } from "../../../utils/cachedManager";
import { decodePremultAndFlip } from "../../../utils/flipPixel";
import { createProgram, createShader } from "../utils/glHelper";
import { getBufferManager, getFullQuadShader } from "../vertexShader";
import { Rect } from "@/core/utils/rect";

import selectionFrag from "./selection.frag?raw";

export function getSelectionManager(canvas, gl) {
  const manager = getManager(gl, "selection", () =>
    createSelectionManager(canvas, gl),
  );
  return manager;
}

function createSelectionManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);

  let selectionPos = {
    x: 0,
    y: 0,
    width: 9,
    height: 9,
  };

  let originalWidth;
  let originalHeight;

  // 텍스처 생성
  const selectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, selectionTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // 무엇이 나을까
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const renderedSelectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fullQuadVertexShader = getFullQuadShader(gl);
  let selectionShader = createShader(gl, gl.FRAGMENT_SHADER, selectionFrag);
  let selectionProgram = createProgram(
    gl,
    fullQuadVertexShader,
    selectionShader,
  );
  gl.useProgram(selectionProgram);

  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection_source"),
    TEXTURE_UNIT.SOURCE_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  );

  const bufferManager = getBufferManager(gl);
  bufferManager.createFullQuadVAO(selectionProgram);

  const selectionFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);
  gl.framebufferTexture2D(
    gl.READ_FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    selectionTex,
    0,
  );

  const renderedSelectionFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderedSelectionFBO);
  gl.framebufferTexture2D(
    gl.DRAW_FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    renderedSelectionTex,
    0,
  );

  function openTexture() {
    //console.log("openTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);

    // 선택창 크기 변경은 자주 일어나므로, 텍스쳐 크기를 매번 변경하기 힘들다. 그래서 미리 늘려놓는다.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintConfig.maxSize,
      paintConfig.maxSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  function closeTexture() {
    //console.log("closeTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, selectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      1, // 텍스처 폭
      1, // 텍스처 높이
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      null,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  // 늘린 텍스쳐에 늘려서 복사하기
  function uploadRenderedTex(force = false) {
    if (selectionPos.width <= 2048.0 && selectionPos.height <= 2048.0) {
    } else if (force) {
    } else {
      return;
    }

    // console.log("selection render!");

    // 원본 텍스처가 붙을 FBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);
    // 크기 늘린 텍스처가 붙을 FBO
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderedSelectionFBO);

    // GPU를 이용해 텍스처 크기 조정 (원본 → 늘어난 크기)
    gl.blitFramebuffer(
      0,
      0,
      originalWidth,
      originalHeight, // 원본 영역
      0,
      0,
      selectionPos.width,
      selectionPos.height, // 목표 영역 (크기 조정됨)
      gl.COLOR_BUFFER_BIT,
      paintOptions.selectionAntialias ? gl.LINEAR : gl.NEAREST,
    );
  }

  function createCurrentSnapshot() {
    const renderRect = Rect.fromWidth(0, 0, originalWidth, originalHeight);

    // selectionCopyTex가 연결된 framebuffer에서 직접 픽셀 데이터 읽기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);
    const pixels = new Uint8Array(originalWidth * originalHeight * 4); // RGBA, UNSIGNED_BYTE

    const sizeInBytes = pixels.byteLength;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `[SelectionManager] Pixel data size: ${sizeInBytes} bytes (${sizeInMB} MB) - ${originalWidth}x${originalHeight}`,
    );

    gl.readPixels(
      0,
      0,
      originalWidth,
      originalHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    let pixelReader = PixelStore.fromPixelData(
      pixels,
      originalWidth,
      originalHeight,
    );

    const selectionPosRect = Rect.fromWidth(
      selectionPos.x,
      selectionPos.y,
      selectionPos.width,
      selectionPos.height,
    );

    let showSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: pixelReader,
      rect: renderRect,
      selectionRect: selectionPosRect,
      async apply() {
        openTexture();
        selectionPos.x = this.selectionRect.x;
        selectionPos.y = this.selectionRect.y;
        selectionPos.width = this.selectionRect.width;
        selectionPos.height = this.selectionRect.height;
        originalWidth = this.rect.width;
        originalHeight = this.rect.height;

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
        gl.bindTexture(gl.TEXTURE_2D, selectionTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0, // level
          gl.RGBA, // internalFormat
          originalWidth, // 텍스처 폭
          originalHeight, // 텍스처 높이
          0, // border
          gl.RGBA, // format
          gl.UNSIGNED_BYTE, // type
          this.pixelReader.getPixelData(),
        );

        paintOptions.showSelection = true;
      },
    };

    let hideSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      rect: renderRect,
      async apply() {
        // 선택창 제거
        paintOptions.showSelection = false;
        closeTexture();
      },
    };

    return {
      show: showSnapshot,
      hide: hideSnapshot,
    };
  }

  function select(sx, sy, swidth, sheight) {
    openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = false;

    selectionPos.x = sx;
    selectionPos.y = sy;
    selectionPos.width = swidth;
    selectionPos.height = sheight;
    originalWidth = swidth;
    originalHeight = sheight;
    beforePos = structuredClone(selectionPos);

    // 1) select texture 크기 조절
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, selectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      originalWidth, // 텍= �처 폭
      originalHeight, // 텍스처 높이
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      null,
    );

    // 2) selection Tex에 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, selectionFBO);

    gl.blitFramebuffer(
      selectionPos.x,
      selectionPos.y,
      selectionPos.x + originalWidth,
      selectionPos.y + originalHeight, // src 영역
      0,
      0,
      originalWidth,
      originalHeight, // dst 영역
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼 (컬러 버퍼)
      gl.NEAREST, // 필터링 모드 (스케일링 없이 복사)
    );

    // 3) 선택된 영역을 완전히 투명으로 지우기
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(sx, sy, swidth, sheight);

    gl.clearColor(0, 0, 0, 0); // RGBA 모두 0
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.SCISSOR_TEST);

    let { show: after, hide: before } = createCurrentSnapshot();

    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(sx, sy, swidth, sheight);

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        await beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "select",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
      redo: async () => {
        await after.apply();
        await afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    uploadRenderedTex();
  }

  function applySelection() {
    paintOptions.showSelection = false;

    gl.useProgram(selectionProgram);
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionPos"),
      selectionPos.x,
      selectionPos.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      selectionPos.width,
      selectionPos.height,
    );
    gl.uniform1f(
      gl.getUniformLocation(selectionProgram, "u_max_size"),
      paintConfig.maxSize,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let { show: before, hide: after } = createCurrentSnapshot();

    // sourceTextureManager rect는 꼭 캔버스 내부 영역으로 제한
    let dirty = Rect.fromWidth(
      selectionPos.x,
      selectionPos.y,
      selectionPos.width,
      selectionPos.height,
    ).clampTo(0, 0, paintOptions.width, paintOptions.height);

    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(dirty.x, dirty.y, dirty.width, dirty.height);

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        await beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
      redo: async () => {
        await after.apply();
        await afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "brush",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    closeTexture();

    renderingManager.render();
  }

  // makeSelection, clearLayer -> drawLayer -> applySelection
  function paste(newx, newy, newwidth, newheight, bitmap: ImageBitmap) {
    openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = true;

    selectionPos.x = newx;
    selectionPos.y = newy;
    selectionPos.width = newwidth;
    selectionPos.height = newheight;
    originalWidth = newwidth;
    originalHeight = newheight;
    beforePos = structuredClone(selectionPos);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // mip level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      bitmap, // ✅ 직접 전달 가능
    );

    uploadRenderedTex();

    let { hide: before, show: after } = createCurrentSnapshot();

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "select",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
      redo: async () => {
        await after.apply();
        uploadRenderedTex();

        renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
    });

    let historyManager = getHistoryManager(canvas, gl);
    historyManager.addUndo(newHistory);

    renderingManager.render();
  }

  function getPixelData() {
    // 픽셀 읽기 준비 (뒤집힌 픽셀)
    const flippedPixel = new Uint8Array(
      selectionPos.width * selectionPos.height * 4,
    );

    console.log("getPixelData", selectionPos.width, selectionPos.height);
    if (selectionPos.width > 2048.0 || selectionPos.height > 2048.0) {
      uploadRenderedTex(true); // 이게 readpixel하려면 어쨌든 텍스쳐에 써야함...
    }

    // 픽셀 읽기
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderedSelectionFBO);
    gl.readPixels(
      0,
      0,
      selectionPos.width,
      selectionPos.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      flippedPixel,
    );

    // 최종 픽셀 (논프멀, 위에서 아래로 플립됨)
    const pixels = decodePremultAndFlip(
      flippedPixel,
      selectionPos.width,
      selectionPos.height,
    );

    return { pixels, width: selectionPos.width, height: selectionPos.height };
  }

  function afterCut() {
    paintOptions.showSelection = false;
    renderingManager.render();
  }

  let beforePos;

  function endMove() {
    let historyManager = getHistoryManager(canvas, gl);
    let beforePosition = structuredClone(beforePos);
    let afterPosition = structuredClone(selectionPos);

    const newHistory = new HistoryObject({
      undo: async () => {
        setSize(
          beforePosition.x,
          beforePosition.y,
          beforePosition.width,
          beforePosition.height,
        );

        beforePos = structuredClone(selectionPos);

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
      redo: async () => {
        setSize(
          afterPosition.x,
          afterPosition.y,
          afterPosition.width,
          afterPosition.height,
        );

        beforePos = structuredClone(selectionPos);

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: selectionPos.x,
            y: selectionPos.y,
            width: selectionPos.width,
            height: selectionPos.height,
          },
        };
      },
    });

    beforePos = structuredClone(selectionPos);

    historyManager.addUndo(newHistory);
  }

  function setSize(newX, newY, newWidth, newHeight) {
    selectionPos.x = newX;
    selectionPos.y = newY;

    if (selectionPos.width != newWidth || selectionPos.height != newHeight) {
      console.log("selection size:", newWidth, newHeight);
      // 텍스쳐 크기 재조정.
      // 텍스쳐는 선택 원본 텍스쳐, 선택 렌더링용 텍스쳐 두개를 분리해야하고.
      // 화면에 보여줄 때는 렌더셀렉트을 보여주고, 리드픽셀 할때도 렌더셀렉트를 읽어야한다.
      // 원본 선택 텍스는 오직 크기 변경시 렌더셀렉트를 구현하기 위해 존재한다.
      // 선택 이미지가 바뀌었을 때도 소스셀렉트를 먼저 그것으로 바꾸고, 렌더셀렉트를 렌더링 해야한다.

      selectionPos.width = newWidth;
      selectionPos.height = newHeight;

      uploadRenderedTex();
    }

    renderingManager.render();
  }

  function getPosition() {
    return {
      x: selectionPos.x,
      y: selectionPos.y,
      width: selectionPos.width,
      height: selectionPos.height,
    };
  }

  return {
    texture: selectionTex,
    getPosition,
    setSize: setSize,
    applySelection,
    select,
    paste,
    getPixelData,
    afterCut,
    endMove,
  };
}
