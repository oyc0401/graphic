import { enable_a_position } from "./vertexShader";

// 헬퍼 함수
export function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

export function createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link failed:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }
    return program;
}

export async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

const glHelpers = new Map();

/**
 * gl 관련 유틸리티 프로그램 모음
 */
export function getGlHelper(gl) {
    if (glHelpers.has(gl)) {
        return glHelpers.get(gl);
    }

    const clearTexture = createClearTextureFunc(gl);
    const clearTextureVec2 = createClearTextureFuncvec2(gl);
    /////
    const helper = {
        clearTexture,
        clearTextureVec2,
    };

    glHelpers.set(gl, helper);

    return helper;
}

/**
 * 텍스쳐를 초기화 해주는 프로그램
 */
function createClearTextureFunc(gl) {
    // 1. FBO 생성
    const fbo = gl.createFramebuffer();

    // 2. 쉐이더 프로그램 생성
    const vsSource = `#version 300 es
        precision highp float;
        in vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

    const fsSource = `#version 300 es
        precision highp float;
        out float fragColor;

        uniform float u_clearValue;

        void main() {
            fragColor = u_clearValue;
        }`;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // 3. 풀스크린 사각형 렌더링
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );

    enable_a_position(gl, program);

    const clearTexture = (texture, width, height, clearValue = 0.0) => {
        gl.useProgram(program);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
        );

        gl.uniform1f(
            gl.getUniformLocation(program, "u_clearValue"),
            clearValue,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    return clearTexture;
}

function createClearTextureFuncvec2(gl) {
    // 1. FBO 생성
    const fbo = gl.createFramebuffer();

    // 2. 쉐이더 프로그램 생성
    const vsSource = `#version 300 es
        precision highp float;
        in vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

    const fsSource = `#version 300 es
        precision highp float;
        out vec4 fragColor;

        uniform vec2 u_clearValue;

        void main() {
            fragColor = vec4(u_clearValue, 0.0, 0.0);
        }`;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    // 3. 풀스크린 사각형 렌더링
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );

    enable_a_position(gl, program);

    const clearTexture = (texture, width, height, clearValue = [0.0, 0.0]) => {
        gl.useProgram(program);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
        );

        gl.uniform2f(
            gl.getUniformLocation(program, "u_clearValue"),
            clearValue[0],
            clearValue[1],
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    return clearTexture;
}
