import {
    TEXTURE_UNIT,
    getSourceTextureManager,
    paintOptions,
    getOffscreenManager,
} from "../texture";
import { getFullQuadVertexShader } from "../vertexShader";

import {
    getIntegralEaseInOut,
    getIntegralEaseInOutMirror,
} from "./cachedIntegrals";

import {
    createShader,
    createProgram,
    loadShader,
    getGlHelper,
} from "../glHelper";
import { Tool } from "./tool";

export interface LiquifyTool extends Tool {
    push(p1, p2): void;
    render(): void;
    setStrength(s): void;
}

const liquifyManagerStore = new Map();

export async function getLiquifyManager(canvas, gl): Promise<LiquifyTool> {
    if (liquifyManagerStore.has(gl)) {
        return liquifyManagerStore.get(gl);
    }

    const brushManager = await makeLiquifyManager(canvas, gl);
    liquifyManagerStore.set(gl, brushManager);

    return brushManager;
}

async function makeLiquifyManager(canvas, gl): Promise<LiquifyTool> {
    console.log("make liquify");
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
            "This device does not support linear filtering for float textures.",
        );
    }

    // 원본 이미지 텍스처 생성
    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    const fullQuadVertexShader = getFullQuadVertexShader(gl);

    let liquifyPushFragSrc = `#version 300 es
        precision highp float;
    
        uniform sampler2D u_displacement;
        uniform sampler2D u_ease_integral;
        uniform sampler2D u_ease_mirror;
    
        uniform vec2 u_resolution; // 화면크기, 해상도
        uniform vec2 u_start;
        uniform vec2 u_end;
        uniform float u_radius;
        uniform float u_strength;
    
        in vec2 v_texCoord;
        out vec2 outDisplacement;
    
        // 샘플링을 통한 ease 함수 구현 (정확한 결과를 위해 precomputed 텍스처 사용)
        float easeInOutCubicIntegral(float x) {
          // x를 [0,1]로 가정하고, 1D 텍스처에서 선형 보간
          return texture(u_ease_integral, vec2(x, 0.5)).r;
        }
        float easeInOutCubicIntegralMirror(float x) {
          return texture(u_ease_mirror, vec2(x, 0.5)).r;
        }
    
        // getPower()와 유사한 로직: liquify 그리드 내에서 현재 픽셀의 영향력을 계산합니다.
        float getPower(vec2 centerCoord, vec2 d, float radius) {
          // d의 길이
          float len = length(d);
          if (len == 0.0) {
            return 1.0;
          }
          // radius의 올림값 및 자주 쓰이는 상수
          float rCeil = ceil(radius);
          float doubleRCeil = 2.0 * rCeil;
    
          // sqrt를 줄이기위한 제곱 연산
          float squareR = radius * radius;
    
          // 그리드 크기 계산
          float gridWidth = abs(d.x) + 1.0 + doubleRCeil;
          float gridHeight = abs(d.y) + 1.0 + doubleRCeil;
    
          // 단위 벡터
          vec2 unit = d / len;
    
          // localStart 계산
          float localStartX = (d.x > 0.0) ? rCeil : (gridWidth - 1.0 - rCeil);
          float localStartY = (d.y > 0.0) ? rCeil : (gridHeight - 1.0 - rCeil);
          vec2 localStart = vec2(localStartX, localStartY);
    
          vec2 v = centerCoord - localStart;
          float t = dot(v, unit);
    
          // dist = v와 center(t * unit) 사이의 길이
          vec2 center = t * unit;
          vec2 d22 = v - center;
          float dist = length(d22);
    
          float percent = 1.0;
          float power = 0.0;
    
          // 1) (t > 0.0 && t < len)
          if (t > 0.0 && t < len) {
            float value = min(1.0, dist / radius);
            float addValue = easeInOutCubicIntegral(value);
            power = addValue * radius * 2.0;
          }
    
          // 2) vLength < radius
          //float vLength;
          float dotV = dot(v, v);
          if (dotV < squareR) {
            float value = min(1.0, dist / radius);
            float addValue = easeInOutCubicIntegral(value);
            power = addValue * radius * 2.0 * percent;
          }
    
          // 3) eLength < radius
          vec2 eVec = v - d;
          // float eLength;
          float dotE = dot(eVec, eVec);
          if (dotE < squareR) {
            float value = min(1.0, dist / radius);
            float addValue = easeInOutCubicIntegral(value);
            power = addValue * radius * 2.0 * percent;
          }
    
          // 4) gradation 계산
          float originalCell = power;
          if (dotV < squareR) {
            float gradation = (radius + t) / radius / 2.0;
            power -= originalCell * (1.0 - easeInOutCubicIntegralMirror(gradation));
          }
          if (dotE < squareR) {
            float gradation = (radius + (len - t)) / radius / 2.0;
            power -= originalCell * (1.0 - easeInOutCubicIntegralMirror(gradation));
          }
    
          return power;
        }
    
        void main() {
          // 현재 픽셀의 기존 변위값
          vec2 value = texture(u_displacement, v_texCoord).xy;
    
          // 현재 픽셀 좌표 (ex: (250,360))
          vec2 pixel = v_texCoord * u_resolution;
          float ceiledRadius = ceil(u_radius);
    
          // 영역 계산
          vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
          vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);
    
          // 영향 영역 밖은 기존 변위값 그대로
          if (
            pixel.x < minCoord.x || pixel.x > maxCoord.x ||
            pixel.y < minCoord.y || pixel.y > maxCoord.y
          ) {
            outDisplacement = value;
            return;
          }
    
          // liquify 그리드 계산 (CPU 코드와 동일한 방식)
          vec2 d = u_end - u_start;
          float len = length(d);
          if (len == 0.0) {
            // u_start == u_end라면 이동 없음
            outDisplacement = value;
            return;
          }
    
          vec2 unit = d / len;
          // gridSize와 startXY
          vec2 gridSize = abs(u_end - u_start) + vec2(1.0) + vec2(2.0 * ceiledRadius);
          vec2 startXY = min(u_start, u_end) - vec2(ceiledRadius);
    
          // 좌표 역순 보정
          vec2 centerCoord = gridSize - 1.0 - pixel + startXY;
          float movementPower = getPower(centerCoord, d, u_radius);
    
          float diffVal = (movementPower * u_strength) * 0.5;
    
          // 기존 변위 텍스처에서 보간
          vec2 displacedCoord = pixel - diffVal * unit;
          vec2 targetDisplace = displacedCoord / u_resolution;
    
          vec2 dispSample = texture(u_displacement, targetDisplace).xy;
          outDisplacement = dispSample - diffVal * unit;
        }
    `;
    let liquifyPushShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        liquifyPushFragSrc,
    );
    let liquifyPushProgram = createProgram(
        gl,
        fullQuadVertexShader,
        liquifyPushShader,
    );
    gl.useProgram(liquifyPushProgram);

    // 변위맵 텍스처 생성 및 데이터 업로드
    let displacementTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, displacementTex);

    // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 대문에
    // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(liquifyPushProgram, "u_displacement"),
        TEXTURE_UNIT.DISPLACEMENT,
    );

    // 출력용 텍스처 생성
    let displacementTexOut = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOut);

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
        integralData,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(liquifyPushProgram, "u_ease_integral"),
        TEXTURE_UNIT.EASE_INTEGRAL,
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
        integralMirrorData,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(liquifyPushProgram, "u_ease_mirror"),
        TEXTURE_UNIT.EASE_MIRROR,
    );

    // 프레임버퍼 생성 및 바인딩
    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        displacementTexOut,
        0,
    );

    // 쓰여진 결과를 기본 변위맵에 업로드 하기 위해서
    let readFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFrameBuffer);
    gl.framebufferTexture2D(
        // 당장 안쓰더라도 바인딩 해놓으면 내부에서 자체 최적화 되나?
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        displacementTexOut,
        0,
    );

    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
        gl.STATIC_DRAW,
    );
    let posLoc = gl.getAttribLocation(liquifyPushProgram, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    let colorShaderSource = `#version 300 es
      precision highp float;
      uniform sampler2D u_displacement;
      uniform sampler2D u_sourse;  // 원본 텍스처
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
                vec4 newColor = texture(u_sourse, target);
                float newAlpha = newColor.a;
                outColor = vec4(newColor.rgb * newAlpha , newAlpha);
               //outColor = texture(u_sourse, target);
          }
      }
      `;

    let renderShader = createShader(gl, gl.FRAGMENT_SHADER, colorShaderSource);
    let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
    gl.useProgram(renderProgram);

    gl.uniform1i(
        gl.getUniformLocation(renderProgram, "u_displacement"),
        TEXTURE_UNIT.DISPLACEMENT,
    );

    gl.uniform1i(
        gl.getUniformLocation(renderProgram, "u_sourse"),
        TEXTURE_UNIT.SOURCE,
    ); // 텍스처 유닛 1에 할당

    let posLoc2 = gl.getAttribLocation(renderProgram, "a_position");
    gl.enableVertexAttribArray(posLoc2);
    gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

    ////////////////

    let strength = 1;
    let pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

    /////////////////////////////

    // 취소 구현...
    let sourceDisplacementTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function setSize() {
        const width = paintOptions.width;
        const height = paintOptions.height;

        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);

        gl.useProgram(liquifyPushProgram);

        gl.uniform2f(
            gl.getUniformLocation(liquifyPushProgram, "u_resolution"),
            width,
            height,
        );

        gl.useProgram(renderProgram);
        gl.uniform2f(
            gl.getUniformLocation(renderProgram, "u_resolution"),
            width,
            height,
        );

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
        gl.bindTexture(gl.TEXTURE_2D, displacementTex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RG32F,
            width,
            height,
            0,
            gl.RG,
            gl.FLOAT,
            null,
        );

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
        gl.bindTexture(gl.TEXTURE_2D, displacementTexOut);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RG32F,
            width,
            height,
            0,
            gl.RG,
            gl.FLOAT,
            null,
        );

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
        gl.bindTexture(gl.TEXTURE_2D, sourceDisplacementTex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RG32F,
            width,
            height,
            0,
            gl.RG,
            gl.FLOAT,
            null,
        );

        clearMap();
    }
    setSize();

    let offScreenManager = getOffscreenManager(canvas, gl);

    function start(pointer) {
        pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 }; // pointer에 맞는 범위 지정

        let ceiledRadius = Math.ceil(paintOptions.radius);

        console.log("시작!");
        pathDirtyRect.x = pointer.x - ceiledRadius;
        pathDirtyRect.y = pointer.y - ceiledRadius;
        pathDirtyRect.ex = pointer.x + ceiledRadius;
        pathDirtyRect.ey = pointer.y + ceiledRadius;
        pathDirtyRect.width = 2 * ceiledRadius + 1;
        pathDirtyRect.height = 2 * ceiledRadius + 1;
    }

    function updatePathDirtyRect(pointer) {
        let ceiledRadius = Math.ceil(paintOptions.radius);
        let minX = Math.min(pathDirtyRect.x, pointer.x - ceiledRadius);
        let maxX = Math.max(pathDirtyRect.ex, pointer.x + ceiledRadius);
        let minY = Math.min(pathDirtyRect.y, pointer.y - ceiledRadius);
        let maxY = Math.max(pathDirtyRect.ey, pointer.y + ceiledRadius);

        pathDirtyRect.x = minX;
        pathDirtyRect.y = minY;
        pathDirtyRect.ex = maxX;
        pathDirtyRect.ey = maxY;

        //console.log(pathDirtyRect);
    }

    function push(start, end) {
        let height = paintOptions.height;

        gl.useProgram(liquifyPushProgram);
        // 유나폼 변수 설정
        gl.uniform1f(
            gl.getUniformLocation(liquifyPushProgram, "u_radius"),
            paintOptions.radius,
        );
        gl.uniform1f(
            gl.getUniformLocation(liquifyPushProgram, "u_strength"),
            strength,
        );

        gl.uniform2f(
            gl.getUniformLocation(liquifyPushProgram, "u_start"),
            start.x,
            height - start.y,
        );
        gl.uniform2f(
            gl.getUniformLocation(liquifyPushProgram, "u_end"),
            end.x,
            height - end.y,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        // 프레임버퍼에 쓰기 텍스처 넣기
        // 이전에 blit할때 다른거 지정되어있었음
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTexOut,
            0,
        );

        let ceiledRadius = Math.ceil(paintOptions.radius);
        let minX = Math.min(start.x, end.x);
        let maxX = Math.max(start.x, end.x);
        let minY = Math.min(height - start.y, height - end.y);
        let maxY = Math.max(height - start.y, height - end.y);

        let dirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

        dirtyRect.x = minX - ceiledRadius;
        dirtyRect.y = minY - ceiledRadius;
        dirtyRect.ex = maxX + ceiledRadius;
        dirtyRect.ey = maxY + ceiledRadius;
        dirtyRect.width = maxX - minX + 1 + 2 * ceiledRadius;
        dirtyRect.height = maxY - minY + 1 + 2 * ceiledRadius;

        updatePathDirtyRect(start);
        updatePathDirtyRect(end);

        // SCISSOR TEST로 일부만 렌더링
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
        gl.viewport(0, 0, paintOptions.width, paintOptions.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 적용된 텍스처를 read에도 옮기기
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

        gl.framebufferTexture2D(
            gl.READ_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTexOut,
            0,
        );

        gl.framebufferTexture2D(
            gl.DRAW_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTex,
            0,
        );

        gl.blitFramebuffer(
            dirtyRect.x,
            dirtyRect.y,
            dirtyRect.ex,
            dirtyRect.ey, // 소스
            dirtyRect.x,
            dirtyRect.y,
            dirtyRect.ex,
            dirtyRect.ey, // 대상
            gl.COLOR_BUFFER_BIT,
            gl.NEAREST,
        );
    }

    function render() {
        gl.useProgram(renderProgram);
        // 쓰기 영역: 내 화면
        gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenManager.offscreenFBO);
        gl.viewport(0, 0, paintOptions.width, paintOptions.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.SCISSOR_TEST);

        offScreenManager.renderOffscreenToCanvas();
    }

    function transfer(aTex, bTex) {
        let height = paintOptions.height;

        // sourceDisplacementTex -> displacementTex

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

        gl.framebufferTexture2D(
            gl.READ_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            aTex,
            0,
        );

        gl.framebufferTexture2D(
            gl.DRAW_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            bTex,
            0,
        );

        gl.blitFramebuffer(
            pathDirtyRect.x,
            height - pathDirtyRect.y,
            pathDirtyRect.ex,
            height - pathDirtyRect.ey, // 소스
            pathDirtyRect.x,
            height - pathDirtyRect.y,
            pathDirtyRect.ex,
            height - pathDirtyRect.ey, // 대상
            gl.COLOR_BUFFER_BIT,
            gl.NEAREST,
        );
    }

    function setStrength(s) {
        strength = s;
    }
    function clearMap() {
        let width = paintOptions.width;
        let height = paintOptions.height;

        let glHelper = getGlHelper(gl);
        glHelper.clearTextureVec2(displacementTex, width, height, [0, 0]);
        glHelper.clearTextureVec2(sourceDisplacementTex, width, height, [0, 0]);
    }

    let Liquify = {
        enter() {},
        start,
        push,
        render,
        end() {
            // displacementTex -> sourceDisplacementTex
            transfer(displacementTex, sourceDisplacementTex);
        },
        cancel() {
            // sourceDisplacementTex -> displacementTex
            transfer(sourceDisplacementTex, displacementTex);
            render();
        },
        exit() {
            clearMap();
            sourceTextureManager.uploadCurrent();
        },
        setSize,
        setStrength,
    };

    return Liquify;
}
