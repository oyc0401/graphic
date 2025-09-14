import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../../texture";
import { getLayerManager } from "../../layer";
import { getBufferManager, getFullQuadShader } from "../../vertexShader";

import { createShader, createProgram, getGlHelper } from "../../utils/glHelper";
import { getRenderingManager } from "../../render/render";
import {
  getHistoryManager,
  HistoryObject,
  Snapshot,
} from "../../history/history";

import { PixelReader } from "../../history/PixelReader";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";

import colorFrag from "./color.frag?raw";
import { DisplacementModifier } from "./DisplacementModifier";

interface liquifyManager {
  enter(): void;

  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  render: () => void;

  end(): void;

  cancel(): void;

  exit(): void;

  setSize: () => void;
}

const liquifyManagerStore = new Map<any, liquifyManager>();

export async function installLiquifyManager(canvas, gl) {
  let liquifyManager = await makeLiquifyManager(canvas, gl);
  liquifyManagerStore.set(gl, liquifyManager);
}

export function getLiquifyManager(canvas, gl) {
  let liquifyManager = liquifyManagerStore.get(gl)!;
  if (!liquifyManager) {
    console.error("Not Installed LiquifyManager!");
  }

  return liquifyManager;
}

async function makeLiquifyManager(canvas, gl) {
  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);

  // Create displacement input texture and framebuffer
  let displacementTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
  gl.bindTexture(gl.TEXTURE_2D, displacementTex);

  // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 때문에
  // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 프레임버퍼 생성 및 바인딩
  let displaceFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, displaceFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    displacementTex,
    0,
  );

  // Create displacement modifier
  let displacementModifier = await DisplacementModifier.create(
    gl,
    displacementTex,
    displaceFBO,
  );

  const fullQuadVertexShader = getFullQuadShader(gl);
  const bufferManager = getBufferManager(gl);

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, colorFrag);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_displacement"),
    TEXTURE_UNIT.DISPLACEMENT,
  );

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_source"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(renderProgram);

  // enter부터 exitRkwl?
  let imageDirty: DirtyRectRecorder;
  // 이전에 적용된 더티사각형
  let sourceImageDirty: Rect | null = null;
  /////////////////////////////

  let scissorRect: Rect;

  let layerManager = getLayerManager(canvas, gl);
  let renderingManager = getRenderingManager(canvas, gl);

  let sourceDisplacementTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
  gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let sourceDisplacementFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sourceDisplacementFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    sourceDisplacementTex,
    0,
  );

  const fbo = gl.createFramebuffer();

  function makeDirtyTexture(rect: Rect) {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      rect.width,
      rect.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여  면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);

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
      rect.x,
      rect.y,
      rect.right,
      rect.bottom,
      0,
      0,
      rect.width,
      rect.height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  async function applyHistory(pixelReader, rect) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTex);

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.HALF_FLOAT,
      await pixelReader.getPixelData(),
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceDisplacementFBO);

    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function uploadAndMakeHistory(x, y, width, height) {
    let renderRect = Rect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT,
    );

    let beforeDirty: Rect | null = null;
    if (sourceImageDirty) {
      beforeDirty = sourceImageDirty.copy();
    }

    let beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = DirtyRectRecorder.clampedRect(
          0,
          0,
          paintOptions.width,
          paintOptions.height,
        );
        if (beforeDirty) {
          imageDirty.updateRect(beforeDirty);
        }
      },
    };

    // sourceMap으로 업로드
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceDisplacementFBO);
    gl.blitFramebuffer(
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT,
    );

    let afterDirty: Rect | null = null;
    if (imageDirty.hasBeenDirty()) {
      afterDirty = imageDirty.generateRect();
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = DirtyRectRecorder.clampedRect(
          0,
          0,
          paintOptions.width,
          paintOptions.height,
        );
        if (afterDirty) {
          imageDirty.updateRect(afterDirty);
        }
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  function clearAndMakeHistory(x, y, width, height) {
    let renderRect = Rect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT,
    );

    let beforeDirty: Rect | null = null;
    if (sourceImageDirty) {
      beforeDirty = sourceImageDirty.copy();
    }
    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);

        imageDirty = DirtyRectRecorder.clampedRect(
          0,
          0,
          paintOptions.width,
          paintOptions.height,
        );
        if (beforeDirty) {
          imageDirty.updateRect(beforeDirty);
        }
      },
    };

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT,
    );

    let afterDirty: Rect | null = null;
    if (imageDirty.hasBeenDirty()) {
      afterDirty = imageDirty.generateRect();
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = DirtyRectRecorder.clampedRect(
          0,
          0,
          paintOptions.width,
          paintOptions.height,
        );
        if (afterDirty) {
          imageDirty.updateRect(afterDirty);
        }
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  function restore(rect: Rect) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, displaceFBO);

    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function openTexture() {
    displacementModifier.resetWorkSpace(
      paintOptions.width,
      paintOptions.height,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.useProgram(renderProgram);
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
  }

  function closeTexture() {
    displacementModifier.exit();

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );
  }

  function enterLogic() {
    imageDirty = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    openTexture();
  }

  let Liquify = {
    enter() {
      enterLogic();
      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          closeTexture();
          return { tool: "brush" };
        },
        redo: async () => {
          enterLogic();
          return { tool: "liquify" };
        },
      });
      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
    },
    start(pointer) {
      //console.log("시작!");

      let ceiledRadius = Math.ceil(paintOptions.radius);
      displacementModifier.start(pointer);

      imageDirty.updatePointer(pointer, ceiledRadius);
    },
    push(start, end) {
      let rect = displacementModifier.push(start, end);
      if (rect) {
        scissorRect = rect; // brush/eraser 렌더 영역으로 사용
      }
      imageDirty.updatePointer(start, paintOptions.radius);
      imageDirty.updatePointer(end, paintOptions.radius);
    },
    render() {
      gl.useProgram(renderProgram);
      // 쓰기 영역: 내 화면
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorRect);
    },
    end() {
      let strokeRect = displacementModifier.getStrokeDirtyRect();
      const { before, after } = uploadAndMakeHistory(
        strokeRect.x,
        strokeRect.y,
        strokeRect.width,
        strokeRect.height,
      );
      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          await before.apply();
          this.render();
          return { tool: "liquify" };
        },
        redo: async () => {
          await after.apply();
          this.render();
          return { tool: "liquify" };
        },
      });

      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);

      sourceImageDirty = imageDirty.generateRect();
    },
    cancel() {
      restore(displacementModifier.getStrokeDirtyRect());

      this.render();
    },
    exit() {
      imageDirty = DirtyRectRecorder.clampedRect(
        0,
        0,
        paintOptions.width,
        paintOptions.height,
      );
      let historyManager = getHistoryManager(canvas, gl);

      if (sourceImageDirty) {
        const { before, after } = clearAndMakeHistory(
          sourceImageDirty.x,
          sourceImageDirty.y,
          sourceImageDirty.width,
          sourceImageDirty.height,
        );
        let { before: beforeSource, after: afterSource } =
          sourceTextureManager.upload(
            sourceImageDirty.x,
            sourceImageDirty.y,
            sourceImageDirty.width,
            sourceImageDirty.height,
          );

        const newHistory = new HistoryObject(gl, {
          undo: async () => {
            enterLogic();
            await before.apply();
            await beforeSource.apply();
            this.render();
            return { tool: "liquify" };
          },
          redo: async () => {
            await after.apply();
            await afterSource.apply();
            this.render();
            closeTexture();
            return { tool: "brush" };
          },
        });

        historyManager.addUndo(newHistory);
      } else {
        const newHistory = new HistoryObject(gl, {
          undo: async () => {
            enterLogic();
            this.render();
            return { tool: "liquify" };
          },
          redo: async () => {
            this.render();
            closeTexture();
            return { tool: "brush" };
          },
        });

        historyManager.addUndo(newHistory);
      }

      closeTexture();

      sourceImageDirty = null;
    },
    setSize: () => {},
  };

  return Liquify;
}
