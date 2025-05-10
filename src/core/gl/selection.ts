import { paintConfig } from "@/paint.config";
import { mainThread } from "../worker/mainPool";
import { getHistoryManager, HistoryItem } from "./history/history";
import { PixelReader } from "./history/PixelReader";
import { pushReadPixelQueue } from "./history/pixelReadProcessor";
import { getLayerManager } from "./layer";
import { getRenderingManager } from "./render";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { HistoryObject, Snapshot } from "./tool/liquify";
import { getManager } from "./utils/cachedManager";
import { DirtyRect, Rect } from "./utils/dirtyRect";
import { decodePremultAndFlip } from "./utils/flipPixel";
import { createProgram, createShader } from "./utils/glHelper";
import { getBufferManager, getFullQuadShader } from "./vertexShader";

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
  // let selectionPos.x = 0;
  // let selectionPos.y = 0;
  // let selectionPos.width = 10;
  // let selectionPos.height = 10;

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

  let selectionShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_selection_source;
    uniform sampler2D u_selection;
    uniform sampler2D u_source;

    uniform vec2 u_resolution;      // 실제 캔버스 크기 (px)

    uniform vec2 u_selectionPos;    // 선택 영역 위치 (캔버스 내부 기준)
    uniform vec2 u_selectionSize;   // 선택 영역 크기

    in vec2 v_texCoord;             // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;

    void main() {
      vec2 scaledScreenSize = u_resolution;

      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      vec2 size = u_selectionSize;

      // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 selectionPos = vec2(u_selectionPos.x, u_selectionPos.y);
      vec2 minPos = selectionPos;
      vec2 maxPos = selectionPos + size;

      // 현재 픽셀이 selection 안에 있지 않으면 버림
      if (
        scaledFragCoord.x < minPos.x || scaledFragCoord.x > maxPos.x ||
        scaledFragCoord.y < minPos.y || scaledFragCoord.y > maxPos.y
      ) {
        discard;
      }

      // 선택영역 내에 있으면 텍스처 좌표 계산
      vec2 local = (scaledFragCoord - minPos) / size;
      vec4 selectionColor;
      
      if(u_selectionSize.x > 2048.0 || u_selectionSize.y > 2048.0){
        // 화면이 엄청 크면 걍 근사로
        selectionColor = texture(u_selection_source, local);    // 프리
      } else {
        vec2 newLocal = local * size / ${paintConfig.maxSize}.0;
        selectionColor = texture(u_selection, newLocal);    // 프리
      }
      
      vec4 imageColor = texture(u_source, v_texCoord);      // 프리
      
      float srcA = selectionColor.a;
      float dstA = imageColor.a;
      
      float outA = srcA + dstA * (1.0 - srcA);
      vec3 outRGB = selectionColor.rgb + imageColor.rgb * (1.0 - srcA);
      
      outColor = vec4(outRGB, outA);
    }
  `;
  const fullQuadVertexShader = getFullQuadShader(gl);
  let selectionShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    selectionShaderSource,
  );
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

  const bufferManager = getBufferManager(canvas, gl);
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

  const fbo = gl.createFramebuffer();

  function makeSelectionCopyTexture() {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      originalWidth,
      originalHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여 화면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
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
      originalWidth,
      originalHeight,
      0,
      0,
      originalWidth,
      originalHeight, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  function selectionSnapshot() {
    const renderRect = Rect.fromWidth(0, 0, originalWidth, originalHeight);

    const selectionCopyTex = makeSelectionCopyTexture();

    let pixelReader = new PixelReader(
      gl,
      originalWidth,
      originalHeight,
      selectionCopyTex,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
    );
    pushReadPixelQueue(gl, pixelReader);
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
      apply() {
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
      apply() {
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

    let { show: after, hide: before } = selectionSnapshot();

    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(sx, sy, swidth, sheight);

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "select";
      },
      redo: () => {
        after.apply();
        afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let { show: before, hide: after } = selectionSnapshot();

    // sourceTextureManager rect는 꼭 캔버스 내부 영역으로 제한
    let dirty = DirtyRect.copy(selectionPos);
    let { before: beforeSource, after: afterSource } =
      sourceTextureManager.upload(dirty.x, dirty.y, dirty.width, dirty.height);

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        beforeSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
      redo: () => {
        after.apply();
        afterSource.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "brush";
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

    let { hide: before, show: after } = selectionSnapshot();

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        before.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "select";
      },
      redo: () => {
        after.apply();
        uploadRenderedTex();

        renderingManager.render();

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
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

    const newHistory = new HistoryObject(gl, {
      undo: () => {
        setSize(
          beforePosition.x,
          beforePosition.y,
          beforePosition.width,
          beforePosition.height,
        );

        beforePos = structuredClone(selectionPos);

        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
      },
      redo: () => {
        setSize(
          afterPosition.x,
          afterPosition.y,
          afterPosition.width,
          afterPosition.height,
        );

        beforePos = structuredClone(selectionPos);
        mainThread.setSelectionPosition(
          paintOptions.showSelection,
          selectionPos.x,
          selectionPos.y,
          selectionPos.width,
          selectionPos.height,
        );
        return "selection";
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
