import { resetHisory } from "./history/history";
import { getLayerManager } from "./layer";
import { getRenderingManager } from "./render";
import { resizeLayer } from "./resize";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { getBrushManager } from "./tool/brushTool";
import { getLiquifyManager } from "./tool/liquify";
import { getManager } from "./utils/cachedManager";
import { decodePremultAndFlip } from "./utils/flipPixel";
import { createProgram, createShader } from "./utils/glHelper";
import { getBufferManager, getFullQuadShader } from "./vertexShader";

export function uploadImage(canvas, gl, bitmap: ImageBitmap) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(
    canvas,
    gl,
    paintOptions.x,
    paintOptions.y,
    bitmap.width,
    bitmap.height,
  );

  resetHisory();
  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    bitmap, // ✅ 직접 전달 가능
  );

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTextureManager.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

  sourceTextureManager.upload(0, 0, paintOptions.width, paintOptions.height);

  // 알파맵, 변위맵, 선택창 초기화하기!

  if (paintOptions.toolId != "brush") {
    console.error("브러시일때만 새로운 파일 열기!");
  }

  renderingManager.render();
}

export function resetImage(canvas, gl, width, height) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(canvas, gl, paintOptions.x, paintOptions.y, width, height);

  resetHisory();
  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width, // ✅ 반드시 필요
    height, // ✅ 반드시 필요
    0, // border (항상 0)
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    null, // → allocate only
  );

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTextureManager.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width, // ✅ 반드시 필요
    height, // ✅ 반드시 필요
    0, // border (항상 0)
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    null, // → allocate only
  );

  renderingManager.render();
}

export function getCanvasPixelManager(canvas, gl) {
  const manager = getManager(gl, "canvasPixel", () =>
    canvasPixelManager(canvas, gl),
  );
  return manager;
}

function canvasPixelManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);

  const canvasTex = gl.createTexture();
  const canvasFBO = gl.createFramebuffer();

  const renderSource = `#version 300 es
    precision mediump float;

    uniform sampler2D u_source;   // 원본 텍스처
    
    uniform vec2 u_resolution;    // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)

    in vec2 v_texCoord;           // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;

    void main() {
     outColor = texture(u_source, v_texCoord);
    }
  `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);

  const bufferManager = getBufferManager(canvas, gl);
  bufferManager.createFullQuadVAO(renderProgram);

  function renderTexture() {
    gl.useProgram(renderProgram);

    gl.uniform1i(
      gl.getUniformLocation(renderProgram, "u_source"),
      TEXTURE_UNIT.LAYER,
    );

    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, canvasFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function getCanvasPixelData() {
    // 크기 재설정
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, canvasTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, canvasFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      canvasTex,
      0,
    );

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    // canvasFBO에 layers 순서대로 드로우콜
    for (let i = 0; i < layerManager.layerArray.length; i++) {
      let layerTex = layerManager.layerArray[i];
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
      gl.bindTexture(gl.TEXTURE_2D, layerTex);
      renderTexture();
    }
    // 그리기 완료
    layerManager.bindCurrentLayer();

    gl.disable(gl.BLEND);

    // 픽셀 읽기 시작
    const width = paintOptions.width;
    const height = paintOptions.height;

    // FBO에 그려진 결과를 읽어오기
    const pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let flip = decodePremultAndFlip(pixels, width, height);
    return { pixels: flip, width, height };
  }

  return {
    getCanvasPixelData,
  };
}
