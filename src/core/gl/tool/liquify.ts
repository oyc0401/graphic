import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { getBufferManager, getFullQuadShader } from "../vertexShader";

import {
  getIntegralEaseInOut,
  getIntegralEaseInOutMirror,
} from "./cachedIntegrals";

import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import { getShaderSource } from "./liquifyShader";
import { DirtyRect, Rect } from "../../utils/dirtyRect";
import { getHistoryManager, HistoryItem } from "../../canvas/history/history";

import { PixelReader } from "../../canvas/history/PixelReader";
import { PixelStorage } from "../../canvas/history/PixelStore";

interface liquifyManager {
  enter(): void;

  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  render: () => void;

  end(): void;

  cancel(): void;

  exit(): void;

  setSize: () => void;

  displacementTex;
  displaceFBO;
}

const liquifyManagerStore = new Map<any, liquifyManager>();

export async function installLiquifyManager(canvas, gl) {
  let liquifyManager = await makeLiquifyManager(canvas, gl);
  liquifyManagerStore.set(gl, liquifyManager);
}

export function getLiquifyManager(canvas, gl) {
  let liquifyManager = liquifyManagerStore.get(gl);
  if (!liquifyManager) {
    console.error("Not Installed LiquifyManager!");
  }

  return liquifyManager;
}

async function makeLiquifyManager(canvas, gl) {
  let integralData = await getIntegralEaseInOut(); // 함수 내부에서 캐싱됌 많이 실행해도 ㄱㅊ
  let integralMirrorData = await getIntegralEaseInOutMirror();

  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    console.error("EXT_color_buffer_float not supported!");
  }
  const extFloatLinear =
    gl.getExtension("OES_texture_float_linear") ||
    gl.getExtension("EXT_texture_filter_float");
  if (!extFloatLinear) {
    console.error(
      "This device does not support linear filtering for float textures."
    );
  }

  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);

  let liquifyPushShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    getShaderSource()
  );
  let liquifyPushProgram = createProgram(
    gl,
    fullQuadVertexShader,
    liquifyPushShader
  );
  gl.useProgram(liquifyPushProgram);

  // 변위맵 텍스처 생성 및 데이터 업로드
  let displacementTexInput = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
  gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);

  // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 대문에
  // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_displacement"),
    TEXTURE_UNIT.DISPLACEMENT
  );

  // 출력용 텍스처 생성
  let displacementTexOutput = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const integralTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_INTEGRAL);
  gl.bindTexture(gl.TEXTURE_2D, integralTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    integralData.length,
    1,
    0,
    gl.RED,
    gl.FLOAT,
    integralData
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_ease_integral"),
    TEXTURE_UNIT.EASE_INTEGRAL
  );

  const integralMirrorTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_MIRROR);
  gl.bindTexture(gl.TEXTURE_2D, integralMirrorTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    integralMirrorData.length,
    1,
    0,
    gl.RED,
    gl.FLOAT,
    integralMirrorData
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(
    gl.getUniformLocation(liquifyPushProgram, "u_ease_mirror"),
    TEXTURE_UNIT.EASE_MIRROR
  );

  // 프레임버퍼 생성 및 바인딩
  let displaceInFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, displaceInFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    displacementTexInput,
    0
  );

  // 쓰여진 결과를 기본 변위맵에 업로드 하기 위해서
  let displaceOutFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, displaceOutFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    displacementTexOutput,
    0
  );

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(liquifyPushProgram);

  let colorShaderSource = `#version 300 es
      precision mediump float;
      uniform sampler2D u_displacement;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {

          vec2 value = texture(u_displacement, v_texCoord).xy;
          vec2 dif = value / u_resolution;

          vec2 target = v_texCoord + dif;

          // 범위 넘어가면 투명하게 되는건 나중에 구현이 더 필요함.
          // 테두리 보간 해야함!
          if (target.x < 0.0 || target.x > 1.0 ||
              target.y < 0.0 || target.y > 1.0) {
              // 경계 외부는 투명색 반환
              outColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
                // vec4 newColor = texture(u_source, target);
                // float newAlpha = newColor.a;
                // outColor = vec4(newColor.rgb, newAlpha);
               outColor = texture(u_source, target);
                // outColor = vec4(0.0,1.0,0.0,value.y/8.0);
          }
      }
      `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, colorShaderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_displacement"),
    TEXTURE_UNIT.DISPLACEMENT
  );

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_source"),
    TEXTURE_UNIT.SOURCE
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(renderProgram);

  ////////////////
  let pathDirty = new DirtyRect();
  let imageDirty: DirtyRect | null = null;
  let sourceImageDirty: DirtyRect | null = null;
  /////////////////////////////

  function setSize() {
    const width = paintOptions.width;
    const height = paintOptions.height;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    gl.useProgram(liquifyPushProgram);

    gl.uniform2f(
      gl.getUniformLocation(liquifyPushProgram, "u_resolution"),
      width,
      height
    );

    gl.useProgram(renderProgram);
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      width,
      height
    );
  }

  let layerManager = getLayerManager(canvas, gl);
  let renderingManager = getRenderingManager(canvas, gl);

  function start(pointer) {
    //console.log("시작!");

    let ceiledRadius = Math.ceil(paintOptions.radius);
    pathDirty.reset(pointer, ceiledRadius);
    if (imageDirty) {
      //console.log("liq dirty updatePointer...");
      imageDirty.updatePointer(pointer, ceiledRadius);
    } else {
      imageDirty = new DirtyRect();
      //console.log("liq dirty reset!!!");
      imageDirty.reset(pointer, ceiledRadius);
    }
  }
  // init 시에 한 번만 호출 (ex. setSize()나 초기화 구간)
  const u_radiusLoc = gl.getUniformLocation(liquifyPushProgram, "u_radius");
  const u_strengthLoc = gl.getUniformLocation(liquifyPushProgram, "u_strength");
  const u_startLoc = gl.getUniformLocation(liquifyPushProgram, "u_start");
  const u_endLoc = gl.getUniformLocation(liquifyPushProgram, "u_end");

  let scissorDirty = new DirtyRect();
  function push(start, end) {
    gl.useProgram(liquifyPushProgram);
    // 유나폼 변수 설정
    gl.uniform1f(u_radiusLoc, paintOptions.radius);
    gl.uniform1f(u_strengthLoc, paintOptions.alpha);
    gl.uniform2f(u_startLoc, start.x, start.y);
    gl.uniform2f(u_endLoc, end.x, end.y);

    scissorDirty.reset(start, paintOptions.radius);
    scissorDirty.updatePointer(start, paintOptions.radius);
    scissorDirty.updatePointer(end, paintOptions.radius);

    pathDirty.updatePointer(start, paintOptions.radius);
    pathDirty.updatePointer(end, paintOptions.radius);
    imageDirty.updatePointer(start, paintOptions.radius);
    imageDirty.updatePointer(end, paintOptions.radius);

    // 렌더 대상: output
    gl.bindFramebuffer(gl.FRAMEBUFFER, displaceOutFBO);

    // SCISSOR TEST로 일부만 렌더링
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.width,
      scissorDirty.height
    );
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // output 텍스처를 input 텍스쳐에도 옮기기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceOutFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, displaceInFBO);

    gl.blitFramebuffer(
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.ex + 1,
      scissorDirty.ey + 1, // 소스
      scissorDirty.x,
      scissorDirty.y,
      scissorDirty.ex + 1,
      scissorDirty.ey + 1, // 대상
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );
  }

  function render() {
    gl.useProgram(renderProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    renderingManager.render(Rect.copy(scissorDirty));
  }

  function clearMap() {
    let width = paintOptions.width;
    let height = paintOptions.height;

    let glHelper = getGlHelper(gl);
    glHelper.clearTextureVec2(displacementTexInput, width, height, [0, 0]);
    glHelper.clearTextureVec2(displacementTexOutput, width, height, [0, 0]);
    glHelper.clearTextureVec2(sourceDisplacementTex, width, height, [0, 0]);
  }

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
    0
  );

  const fbo = gl.createFramebuffer();

  function makeDirtyTexture(pathDirty) {
    const historyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      pathDirty.width,
      pathDirty.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null
    ); // 빈 텍스처 생성

    // 4. blitFramebuffer를 사용하여  ��면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      0,
      0,
      pathDirty.width,
      pathDirty.height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST // 필터링 옵션
    );

    return historyTex;
  }

  async function applyHistory(pixelReader, rect) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.HALF_FLOAT,
      await pixelReader.getPixelData()
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceInFBO);
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
      gl.NEAREST
    );
  }

  function uploadAndMakeHistory(x, y, width, height) {
    let renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT
    );

    let beforeDirty: DirtyRect | null = null;
    if (sourceImageDirty) {
      beforeDirty = DirtyRect.copy(sourceImageDirty);
    }

    let beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = beforeDirty;
      },
    };

    // sourceMap으로 업로드
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, displaceInFBO);
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
      gl.NEAREST
    );

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT
    );

    let afterDirty: DirtyRect | null = null;
    if (imageDirty) {
      afterDirty = DirtyRect.copy(imageDirty);
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = afterDirty;
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  function clearAndMakeHistory(x, y, width, height) {
    let renderRect = DirtyRect.fromWidth(x, y, width, height);

    const beforeTex = makeDirtyTexture(renderRect);
    let beforePixelReader = new PixelReader(
      gl,
      width,
      height,
      beforeTex,
      gl.RG,
      gl.HALF_FLOAT
    );

    let beforeDirty: DirtyRect | null = null;
    if (sourceImageDirty) {
      beforeDirty = DirtyRect.copy(sourceImageDirty);
    }
    const beforeSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = beforeDirty;
      },
    };

    // 클리어
    clearMap();

    const afterTex = makeDirtyTexture(renderRect);
    let afterPixelReader = new PixelReader(
      gl,
      width,
      height,
      afterTex,
      gl.RG,
      gl.HALF_FLOAT
    );

    let afterDirty: DirtyRect | null = null;
    if (imageDirty) {
      afterDirty = DirtyRect.copy(imageDirty);
    }
    let afterSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: afterPixelReader,
      rect: renderRect,
      async apply() {
        await applyHistory(this.pixelReader, this.rect);
        imageDirty = afterDirty;
      },
    };

    return {
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }
  function restore(pathDirty) {
    let liquifyManager = getLiquifyManager(canvas, gl);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, liquifyManager.displaceFBO);

    gl.blitFramebuffer(
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      pathDirty.x,
      pathDirty.y,
      pathDirty.ex + 1,
      pathDirty.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );
  }

  setSize();

  function openTexture() {
    //console.log("openTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null
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
      null
    );
  }

  function closeTexture() {
    //console.log("closeTexture");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexInput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOutput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null
    );

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
      null
    );
  }

  let Liquify = {
    enter() {
      openTexture();
      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          closeTexture();
          return "brush";
        },
        redo: async () => {
          openTexture();
          return "liquify";
        },
      });
      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
    },
    start,
    push,
    render,
    end() {
      const { before, after } = uploadAndMakeHistory(
        pathDirty.x,
        pathDirty.y,
        pathDirty.width,
        pathDirty.height
      );
      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          await before.apply();
          render();
          return "liquify";
        },
        redo: async () => {
          await after.apply();
          render();
          return "liquify";
        },
      });

      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);

      sourceImageDirty = DirtyRect.copy(imageDirty);
    },
    cancel() {
      restore(pathDirty);

      render();
    },
    exit() {
      imageDirty = null;
      let historyManager = getHistoryManager(canvas, gl);

      if (sourceImageDirty) {
        const { before, after } = clearAndMakeHistory(
          sourceImageDirty.x,
          sourceImageDirty.y,
          sourceImageDirty.width,
          sourceImageDirty.height
        );
        let { before: beforeSource, after: afterSource } =
          sourceTextureManager.upload(
            sourceImageDirty.x,
            sourceImageDirty.y,
            sourceImageDirty.width,
            sourceImageDirty.height
          );

        const newHistory = new HistoryObject(gl, {
          undo: async () => {
            openTexture();
            await before.apply();
            await beforeSource.apply();
            render();
            return "liquify";
          },
          redo: async () => {
            await after.apply();
            await afterSource.apply();
            render();
            closeTexture();
            return "brush";
          },
        });

        historyManager.addUndo(newHistory);
      } else {
        const newHistory = new HistoryObject(gl, {
          undo: async () => {
            openTexture();
            render();
            return "liquify";
          },
          redo: async () => {
            render();
            closeTexture();
            return "brush";
          },
        });

        historyManager.addUndo(newHistory);
      }

      closeTexture();

      sourceImageDirty = null;
    },
    setSize,
    displacementTex: displacementTexInput,
    displaceFBO: displaceInFBO,
  };

  return Liquify;
}

// 드로우 1 -> 드로우 2 -> 드로우 3 -> 나가기
//       이미지 1 -> 이미지 2 ->  이미지 3
// 드로우2 를 하기 전, start단에서 이미지 1 때의 imageDirty를 보관한다.
// 그리고 드로우 2를 수행하고, 이미지1 에서 Rect2에 해당되는 부분을 텍스쳐화 한다.
// 히스토리에 imageDirty와 Rect2와 텍스쳐를 넣는다.

export interface Snapshot {
  layerId;
  pixelReader?: PixelStorage;
  rect;
  apply: () => Promise<void>;
  selectionRect?;
}

export class HistoryObject {
  gl;
  tool;
  id;
  skip;

  constructor(gl, { undo, redo }) {
    this.gl = gl;
    this.undo = undo;
    this.redo = redo;

    // redoPixels에 Rect2에 해당하는 이미지2 텍스쳐 픽셀리더, redoimageDirty 저장.
    // 결과물을 올리느냐, 또는 pointers를 올리느냐. 그건 자기 입맛대로 하기
  }

  undo: () => Promise<string>;

  redo: () => Promise<string>;
}
