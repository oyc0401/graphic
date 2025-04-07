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
  const layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);

  let x = 0;
  let y = 0;
  let width = 10;
  let height = 10;

  let originalWidth;
  let originalHeight;

  // 텍스처 생성
  const selectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, selectionTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const renderedSelectionTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
  gl.bindTexture(gl.TEXTURE_2D, renderedSelectionTex);

  // 선택창 크기 변경은 자주 일어나므로, 텍스쳐 크기를 매번 변경하기 힘들다. 그래서 미리 늘려놓는다.
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    8192,
    8192,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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
      vec2 newLocal = local * size / 8192.0;

      vec4 selectionColor = texture(u_selection, newLocal);    // 프리
      vec4 imageColor = texture(u_sourse, v_texCoord);      // 프리
      
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
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  );

  enable_a_position(gl, selectionProgram);

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

  // 늘린 텍스쳐에 늘려서 복사하기
  function uploadRenderedTex() {
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
      width,
      height, // 목표 영역 (크기 조정됨)
      gl.COLOR_BUFFER_BIT,
      gl.LINEAR, // 축소 확대 자연스럽게 리니어!
    );
  }

  function select(sx, sy, swidth, sheight) {
    paintOptions.showSelection = true;

    // selection텍스쳐의 크기를 저 크기로 맞추고. layer텍스쳐의 일정 부분을 selection텍스쳐에 복사한다.
    x = sx;
    y = sy;
    width = swidth;
    height = sheight;
    originalWidth = swidth;
    originalHeight = sheight;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);

    const readY = paintOptions.height - (y + originalHeight);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internalFormat
      originalWidth, // 텍스처 폭
      originalHeight, // 텍스처 높이
      0, // border
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      null,
    );
    // 5) 실제 복사: copyTexSubImage2D
    gl.copyTexSubImage2D(
      gl.TEXTURE_2D,
      0, // level
      0, // dstX
      0, // dstY
      x, // srcX
      readY, // srcY
      originalWidth,
      originalHeight,
    );

    // 2) 선택된 영역을 완전히 투명으로 지우기
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, readY, originalWidth, originalHeight);

    gl.clearColor(0, 0, 0, 0); // RGBA 모두 0
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.SCISSOR_TEST);

    uploadRenderedTex();

    // 레이어를 수정했으니 업로드
    sourceTextureManager.uploadCurrent();

    renderingManager.render();
  }

  function paste(newx, newy, newwidth, newheight, bitmap: ImageBitmap) {
    paintOptions.showSelection = true;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // mip level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      bitmap, // ✅ 직접 전달 가능
    );

    x = newx;
    y = newy;
    width = newwidth;
    height = newheight;
    originalWidth = newwidth;
    originalHeight = newheight;

    uploadRenderedTex();

    renderingManager.render();
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

    renderingManager.render();

    sourceTextureManager.uploadCurrent();
  }

  function getPixelData() {
    // 픽셀 읽기 준비 (뒤집힌 픽셀)
    const flippedPixel = new Uint8Array(width * height * 4);

    console.log('getPixelData',width, height)
    // 픽셀 읽기
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderedSelectionFBO);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, flippedPixel);

    // 최종 픽셀 (논프멀, 위에서 아래로 플립됨)
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let row = 0; row < height; row++) {
      const srcStart = row * width * 4;
      const dstStart = (height - row - 1) * width * 4;

      for (let i = 0; i < width; i++) {
        const srcIndex = srcStart + i * 4;
        const dstIndex = dstStart + i * 4;

        const r = flippedPixel[srcIndex + 0];
        const g = flippedPixel[srcIndex + 1];
        const b = flippedPixel[srcIndex + 2];
        const a = flippedPixel[srcIndex + 3];

        if (a > 0) {
          const factor = 255 / a;
          pixels[dstIndex + 0] = Math.min(r * factor, 255);
          pixels[dstIndex + 1] = Math.min(g * factor, 255);
          pixels[dstIndex + 2] = Math.min(b * factor, 255);
        } else {
          // 알파 0이면 RGB도 0
          pixels[dstIndex + 0] = 0;
          pixels[dstIndex + 1] = 0;
          pixels[dstIndex + 2] = 0;
        }

        pixels[dstIndex + 3] = a;
      }
    }

    return { pixels, width, height };
  }

  function afterCut() {
    paintOptions.showSelection = false;
    renderingManager.render();
  }

  function setSize(newX, newY, newWidth, newHeight) {
    x = newX;
    y = newY;

    if (width != newWidth || height != newHeight) {
     // console.log('setsize!', newWidth, newHeight)
      // 텍스쳐 크기 재조정.
      // 텍스쳐는 선택 원본 텍스쳐, 선택 렌더링용 텍스쳐 두개를 분리해야하고.
      // 화면에 보여줄 때는 렌더셀렉트을 보여주고, 리드픽셀 할때도 렌더셀렉트를 읽어야한다.
      // 원본 선택 텍스는 오직 크기 변경시 렌더셀렉트를 구현하기 위해 존재한다.
      // 선택 이미지가 바뀌었을 때도 소스셀렉트를 먼저 그것으로 바꾸고, 렌더셀렉트를 렌더링 해야한다.

      width = newWidth;
      height = newHeight;
      uploadRenderedTex();
    }
    

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
    texture: selectionTex,
    getPosition,
    setSize: setSize,
    applySelection,
    select,
    paste,
    getPixelData,
    afterCut,
  };
}
