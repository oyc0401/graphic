import { getLayerManager } from "./layer";
import { getRenderingManager } from "./render";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { getManager } from "./utils/cachedManager";
import { createProgram, createShader } from "./utils/glHelper";
import { enable_a_position, getFullQuadShader } from "./vertexShader";

export function getSelectionManager(canvas, gl) {
  const manager = getManager(gl, "selection", () =>
    createSelectionManager(canvas, gl),
  );
  return manager;
}

function createSelectionManager(canvas, gl) {
  // 텍스처 생성
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SELECTION); // 9번 텍스처 유닛 활성화
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // 텍스처 데이터 초기화 (하늘색으로 채움: rgba(135, 206, 235, 255))
  let x = 50;
  let y = 50;
  let width = 300;
  let height = 200;

  // 초기 데이터(하늘색)로 채운다 (RGBA: (135,206,235,255))
  const pixelCount = width * height;
  const skyBlue = new Uint8Array(pixelCount * 4); // RGBA 4채널

  for (let i = 0; i < pixelCount; i++) {
    const isTopHalf = i < pixelCount / 2;

    if (isTopHalf) {
      // 자홍색: RGB(255, 0, 255)
      skyBlue[i * 4 + 0] = 250; // R
      skyBlue[i * 4 + 1] = 250; // G
      skyBlue[i * 4 + 2] = 10; // B
      skyBlue[i * 4 + 3] = 120; // A
    } else {
      // 하늘색: RGB(135, 206, 235)
      skyBlue[i * 4 + 0] = 135; // R
      skyBlue[i * 4 + 1] = 206; // G
      skyBlue[i * 4 + 2] = 235; // B
      skyBlue[i * 4 + 3] = 255; // A
    }
  }

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width,
    height,
    0, // border
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    skyBlue,
  );

  // 필터링 및 래핑 설정 (기본값)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);

  let selectionShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_selection;
    uniform sampler2D u_sourse;

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
      vec2 selectionPos = vec2(u_selectionPos.x, scaledScreenSize.y - size.y  - u_selectionPos.y);
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

      vec4 selectionColor = texture(u_selection, local);
      vec4 imageColor = texture(u_sourse, v_texCoord);

      float srcA = selectionColor.a;
      float dstA = imageColor.a;

      float outA = srcA + dstA * (1.0 - srcA);
      vec3 outRGB = imageColor.rgb;
      if (outA > 0.0) {
          outRGB = (
              selectionColor.rgb * srcA + imageColor.rgb * dstA * (1.0 - srcA)
          ) / outA;
      }
      
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
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  );

  enable_a_position(gl, selectionProgram);

  function applySelection() {
    gl.useProgram(selectionProgram);
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionPos"),
      x,
      y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      width,
      height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    sourceTextureManager.uploadCurrent();
    renderingManager.render();
  }
  
  let renderingManager = getRenderingManager(canvas, gl);
  function setSize(newX, newY, newWidth, newHeight) {
    x = newX;
    y = newY;
    width = newWidth;
    height = newHeight;

    renderingManager.render();
  }

  function getPosition() {
    return {
      x,
      y,
      width,
      height,
    };
  }

  return {
    texture,
    getPosition,
    setSize,
    applySelection,
  };
}
