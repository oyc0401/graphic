import { TEXTURE_UNIT, paintOptions } from "../texture";
import { getLayerManager } from "../layer";

import { getSelectionManager } from "../selection";

import {
  getBufferManager,
  getFullQuadShader,
  getVertexManager,
} from "../vertexShader";

import * as twgl from "twgl.js";
import { getManager } from "../../../utils/cachedManager";
import { paintConfig } from "@/paint.config";
import { Rect } from "@/core/utils/rect";

import displayFrag from "./display.frag?raw";
import backgroundFrag from "./background.frag?raw";
import renderFrag from "./render.frag?raw";
import gridFrag from "./grid.frag?raw";
import selectionFrag from "./selection.frag?raw";

export function getRenderingManager(canvas, gl) {
  const manager = getManager(gl, "rendering", () =>
    makeRenderingManager(canvas, gl),
  );
  return manager;
}

function makeRenderingManager(canvas, gl) {
  const offscreenManager = getOffscreenManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  const vertexManager = getVertexManager(gl);

  const displayProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    displayFrag,
  ]);

  twgl.setBuffersAndAttributes(
    gl,
    displayProgramInfo,
    vertexManager.quadBufferInfo,
  );

  function renderDisplay() {
    gl.useProgram(displayProgramInfo.program);

    twgl.setUniforms(displayProgramInfo, {
      u_resolution: [paintOptions.width, paintOptions.height],
      u_pos: [paintOptions.x, paintOptions.y],
      u_screenSize: [paintOptions.screenWidth, paintOptions.screenHeight],
      u_magnification: paintOptions.magnification,
      u_dpr: paintOptions.dpr,
    });

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  const backgroundProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    backgroundFrag,
  ]);

  twgl.setBuffersAndAttributes(
    gl,
    backgroundProgramInfo,
    vertexManager.quadBufferInfo,
  );

  function renderBackground() {
    gl.useProgram(backgroundProgramInfo.program);

    twgl.setUniforms(backgroundProgramInfo, {
      u_resolution: [paintOptions.width, paintOptions.height],
      u_pos: [paintOptions.x, paintOptions.y],
      u_screenSize: [paintOptions.screenWidth, paintOptions.screenHeight],
      u_magnification: paintOptions.magnification,
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  const renderProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    renderFrag,
  ]);

  twgl.setBuffersAndAttributes(
    gl,
    renderProgramInfo,
    vertexManager.quadBufferInfo,
  );
  gl.useProgram(renderProgramInfo.program);

  gl.uniform1i(
    gl.getUniformLocation(renderProgramInfo.program, "u_source"),
    TEXTURE_UNIT.LAYER,
  );

  function renderTexture() {
    gl.useProgram(renderProgramInfo.program);

    twgl.setUniforms(renderProgramInfo, {
      u_resolution: [paintOptions.width, paintOptions.height],
      u_pos: [paintOptions.x, paintOptions.y],
      u_screenSize: [paintOptions.screenWidth, paintOptions.screenHeight],
      u_magnification: paintOptions.magnification,
    });

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * 격자무늬 렌더링
   */

  const gridProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    gridFrag,
  ]);

  twgl.setBuffersAndAttributes(
    gl,
    gridProgramInfo,
    vertexManager.quadBufferInfo,
  );
  gl.useProgram(gridProgramInfo.program);

  function renderGrid() {
    if (paintOptions.magnification / paintOptions.dpr > 20) {
      gl.useProgram(gridProgramInfo.program);

      twgl.setUniforms(gridProgramInfo, {
        u_resolution: [paintOptions.width, paintOptions.height],
        u_pos: [paintOptions.x, paintOptions.y],
        u_screenSize: [paintOptions.screenWidth, paintOptions.screenHeight],
        u_magnification: paintOptions.magnification,
        u_dpr: paintOptions.dpr,
      });

      // 쓰기 영역: 캔버스
      gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
      gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  /**
   * 선택창 렌더링
   */

  const selectionProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    selectionFrag,
  ]);

  twgl.setBuffersAndAttributes(
    gl,
    selectionProgramInfo,
    vertexManager.quadBufferInfo,
  );
  gl.useProgram(selectionProgramInfo.program);

  gl.uniform1i(
    gl.getUniformLocation(selectionProgramInfo.program, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgramInfo.program, "u_selection_source"),
    TEXTURE_UNIT.SOURCE_SELECTION,
  );
  gl.uniform1f(
    gl.getUniformLocation(selectionProgramInfo.program, "u_max_size"),
    paintConfig.maxSize,
  );

  function renderSelection() {
    let selectionManager = getSelectionManager(canvas, gl);
    let selectionPos = selectionManager.getPosition();
    gl.useProgram(selectionProgramInfo.program);

    twgl.setUniforms(selectionProgramInfo, {
      u_pos: [paintOptions.x, paintOptions.y],
      u_resolution: [paintOptions.width, paintOptions.height],
      u_screenSize: [paintOptions.screenWidth, paintOptions.screenHeight],
      u_magnification: paintOptions.magnification,
      u_selectionPos: [selectionPos.x, selectionPos.y],
      u_selectionSize: [selectionPos.width, selectionPos.height],
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderNow(rect: Rect) {
    getSelectionManager(canvas, gl);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    if (paintOptions.selectionAntialias) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    gl.scissor(rect.x, rect.y, rect.width, rect.height);

    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    renderDisplay();

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.BLEND);

    renderBackground();

    // 레이어 전부 그리기
    for (let i = 0; i < layerManager.layerArray.length; i++) {
      let layerTex = layerManager.layerArray[i];
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
      gl.bindTexture(gl.TEXTURE_2D, layerTex);
      renderTexture();
      if (paintOptions.showSelection && i == paintOptions.layerId) {
        renderSelection();
      }
    }
    layerManager.bindCurrentLayer();

    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR);

    renderGrid();

    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    gl.flush();

    // null 프레임버퍼에 전송하기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.blitFramebuffer(
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // src rect
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // dst rect
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR,
    );

    // gl.blitFramebuffer(
    //   rect.x,
    //   rect.y,
    //   rect.width,
    //   rect.height,
    //   rect.x,
    //   rect.y,
    //   rect.width,
    //   rect.height,
    //   gl.COLOR_BUFFER_BIT,
    //   gl.NEAREST,
    // );

    //console.log("render complete!");
  }

  let scheduled = false;

  function render(rect: Rect | undefined = undefined) {
    //console.log("rect:", rect);
    let newRect: Rect;

    if (rect) {
      let calX = Math.floor(rect.x + paintOptions.x);
      let calY = Math.floor(rect.y + paintOptions.y);
      let calW = Math.ceil(rect.width * paintOptions.magnification);
      let calH = Math.ceil(rect.height * paintOptions.magnification);
      //console.log("x:", rect.x, paintOptions.magnification, paintOptions.x);
      //console.log("calculated:", calX, calY, calW, calH);
      newRect = Rect.fromWidth(calX, calY, calW, calH);
    } else {
      newRect = Rect.fromWidth(
        0,
        0,
        paintOptions.screenWidth,
        paintOptions.screenHeight,
      );
    }

    // if (!scheduled) {
    // scheduled = true;
    // requestAnimationFrame(() => {
    //  scheduled = false;
    renderNow(newRect);
    // });
    //}
  }
  return {
    render,
  };
}

export function getOffscreenManager(canvas, gl) {
  const manager = getManager(gl, "offscreen", () =>
    createOffscreenManager(canvas, gl),
  );
  return manager;
}
function createOffscreenManager(canvas, gl) {
  const offscreenTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
  gl.bindTexture(gl.TEXTURE_2D, offscreenTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.screenWidth,
    paintOptions.screenHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const offscreenFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    offscreenTex,
    0,
  );

  function resize(newWidth, newHeight) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
    // temp 크기 설정
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
  }

  return {
    resize,
    offscreenFBO,
  };
}
