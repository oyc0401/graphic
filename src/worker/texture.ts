import { createShader, createProgram } from "./glHelper";
import { getFullQuadVertexShader } from "./vertexShader";

export const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, FBO 전용, 셰이더에서 접근 X!)
  SOURCE: 1, // 원본 이미지 (Source Image)
  PATHMAP: 2, // 브러시, 지우개 알파맵
  TARGET: 3,
  SOURCE_DISPLACEMENT: 4,
  DISPLACEMENT: 5, // 변위맵 (Displacement Map)
  EASE_INTEGRAL: 6, // Ease In-Out Cubic Integral
  EASE_MIRROR: 7, // Ease In-Out Cubic Mirror
};

export let paintOptions = {
  width: 100,
  height: 100,
  radius: 10,
  color: [0, 0, 0],
  alpha: 0.5,
  x: 0,
  y: 0,
  magnification: 1,

  screenWidth: 800,
  screenHeight: 800,

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

const offscreenManagerStore = new Map();

export function getOffscreenManager(canvas, gl) {
  if (offscreenManagerStore.has(gl)) {
    return offscreenManagerStore.get(gl);
  }

  const manager = makeOffscreenManager(canvas, gl);
  offscreenManagerStore.set(gl, manager);

  return manager;
}

function makeOffscreenManager(canvas, gl) {
  let offscreenTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TARGET);
  gl.bindTexture(gl.TEXTURE_2D, offscreenTex);

  // 이걸 스케일 업해서 그리려면, 보간이 없어야함.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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

  let offscreenFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    offscreenTex,
    0,
  );

  ///
  const fullQuadVertexShader = getFullQuadVertexShader(gl);

  let renderShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_sourse;  // 원본 텍스처

      in vec2 v_texCoord;
      out vec4 outColor;
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_screenSize;
      uniform float u_magnification;

      void main() {

        vec2 scaledScreenSize = u_screenSize / u_magnification;
        vec2 ratio =  u_resolution / scaledScreenSize;

        //float left = ((scaledScreenSize.x - u_resolution.x) / 2.0 - u_pos.x) / scaledScreenSize.x;
        //float bottom = ((scaledScreenSize.y - u_resolution.y) / 2.0 + u_pos.y) / scaledScreenSize.y;
        float left = u_pos.x / scaledScreenSize.x;
        float top = u_pos.y / scaledScreenSize.y;
        float bottom = (scaledScreenSize.y - u_resolution.y) / scaledScreenSize.y  - top;

        if( left < v_texCoord.x && v_texCoord.x < left + ratio.x
          && bottom < v_texCoord.y && v_texCoord.y < bottom + ratio.y){

          vec2 target = (v_texCoord - vec2(left, bottom)) / ratio;
          vec4 imageColor = texture(u_sourse, target); // 기존 이미지 색
          outColor = vec4(imageColor.rgb * imageColor.a, imageColor.a);

          return;
        }
        outColor = vec4(0.8, 0.8, 0.8, 1.0);
      }
      `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderShaderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_sourse"),
    TEXTURE_UNIT.TARGET,
  );

  let posLoc = gl.getAttribLocation(renderProgram, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  function renderOffscreenToCanvas() {
    //console.log("render");
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(renderProgram);

    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(renderProgram, "u_magnification"),
      paintOptions.magnification,
    );

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return {
    offscreenTex,
    offscreenFBO,
    renderOffscreenToCanvas,
  };
}

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

  let offScreenManager = getOffscreenManager(canvas, gl);
  uploadCurrent();

  // 이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드
  function uploadCurrent() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenManager.offscreenFBO);

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

  const fullQuadVertexShader = getFullQuadVertexShader(gl);

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

  let posLoc = gl.getAttribLocation(cancelProgram, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // 캔버스를 소스 텍스쳐로 돌려놓기
  function restore() {
    gl.disable(gl.SCISSOR_TEST);

    gl.useProgram(cancelProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenManager.offscreenFBO);
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
