import {
    TEXTURE_UNIT,
    getSourceTextureManager,
    paintOptions,
} from "../texture";
import {getLayerManager} from '../layer'
import { enable_a_position, getFullQuadShader } from "../vertexShader";

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
import { getRenderingManager } from "../render";
import { getShaderSource } from "./liquifyShader";

interface liquifyManager {
    enter(): void;
    start: (pointer: any) => void;
    push: (start: any, end: any) => void;
    render: () => void;
    end(): void;
    cancel(): void;
    exit(): void;
    setSize: () => void;
    setStrength: (s: any) => void;
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
            "This device does not support linear filtering for float textures.",
        );
    }

    // 원본 이미지 텍스처 생성
    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    const fullQuadVertexShader = getFullQuadShader(gl);


    let liquifyPushShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        getShaderSource(),
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

    enable_a_position(gl, liquifyPushProgram);

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
                // outColor = vec4(0.0,1.0,0.0,value.y/8.0);
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

      enable_a_position(gl, renderProgram);

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

    let layerManager = getLayerManager(canvas, gl);
    let renderingManager = getRenderingManager(canvas, gl);
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
        gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.offscreenFBO);
        gl.viewport(0, 0, paintOptions.width, paintOptions.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.SCISSOR_TEST);

        renderingManager.render();
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
