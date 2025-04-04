import { createShader, createProgram } from "./glHelper";
import { enable_a_position, getFullQuadShader } from "./vertexShader";
import { getLayerManager } from "./layer";
export const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, FBO 전용, 셰이더에서 접근 X!)
  LAYER: 1, // 그림을 그릴 대상
  SOURCE: 2, // 원본 이미지 (Source Image)
  PATHMAP: 3, // 브러시, 지우개 알파맵
  SOURCE_DISPLACEMENT: 4,
  DISPLACEMENT: 5, // 변위맵 (Displacement Map)
  EASE_INTEGRAL: 6, // Ease In-Out Cubic Integral
  EASE_MIRROR: 7, // Ease In-Out Cubic Mirror
  SELECTION: 9,
};

export let paintOptions = {
  width: 100,
  height: 100,
  dpr: 1,
  radius: 10,
  color: [0, 0, 0],
  alpha: 0.5,
  x: 0,
  y: 0,
  magnification: 1,

  screenWidth: 800,
  screenHeight: 800,

  showSelection: false,

  setAlpha(newAlpha) {
    paintOptions.alpha = newAlpha;
  },

  setRadius(newRadius) {
    paintOptions.radius = newRadius;
  },

  setColor({ r, g, b }) {
    paintOptions.color[0] = r / 255;
    paintOptions.color[1] = g / 255;
    paintOptions.color[2] = b / 255;
  },
};

/**
 * 소스 텍스쳐는 텍스처 슬롯 1번을 차지하고 있습니다.
 */
const sourceTextureManagers = new Map();

export function getSourceTextureManager(canvas, gl) {
  if (sourceTextureManagers.has(gl)) {
    return sourceTextureManagers.get(gl);
  }

  const sourceTextureManager = makeSourceTextureManager(canvas, gl);
  sourceTextureManagers.set(gl, sourceTextureManager);

  return sourceTextureManager;
}

function makeSourceTextureManager(canvas, gl) {
  let sourceTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let layerManager = getLayerManager(canvas, gl);
  uploadCurrent();

  // 이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드
  function uploadCurrent() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.offscreenFBO);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);

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

    gl.copyTexSubImage2D(
      gl.TEXTURE_2D, // 타겟 텍스처
      0, // 레벨
      0,
      0, // 텍스처 내에서 복사할 시작 좌표
      0,
      0, // 프레임버퍼에서 복사할 시작 좌표
      paintOptions.width,
      paintOptions.height, // 복사할 크기
    );
  }

  const fullQuadVertexShader = getFullQuadShader(gl);

  let cancelShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_sourse;  // 원본 텍스처

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색

        outColor = vec4(imageColor.rgb * imageColor.a, imageColor.a);
      }
      `;

  let cancelShader = createShader(gl, gl.FRAGMENT_SHADER, cancelShaderSource);
  let cancelProgram = createProgram(gl, fullQuadVertexShader, cancelShader);
  gl.useProgram(cancelProgram);

  gl.uniform1i(
    gl.getUniformLocation(cancelProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  );

  enable_a_position(gl, cancelProgram);

  // 캔버스를 소스 텍스쳐로 돌려놓기
  function restore() {
    gl.disable(gl.SCISSOR_TEST);

    gl.useProgram(cancelProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let sourceTextureManager = {
    texture: sourceTexture,
    uploadCurrent,
    restore,
  };

  return sourceTextureManager;
}


