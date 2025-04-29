import { getManager } from "./utils/cachedManager";
import { createShader } from "./utils/glHelper";

/**
 * in vec2 a_position;
 */
export function getFullQuadShader(gl) {
  const manager = getManager(gl, "fullQuadVertexShader", () =>
    makeFullQuadVertexShader(gl),
  );
  return manager;
}

function makeFullQuadVertexShader(gl) {
  let vertexShaderSource = `#version 300 es
  in vec2 a_position;
  out vec2 v_texCoord; // 좌표변환: 0 ~ 1

  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
  `;

  let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  return vertexShader;
}

export function getBufferManager(canvas, gl) {
  const manager = getManager(gl, "bufferManager", () => makeBufferManager(gl));
  return manager;
}

function makeBufferManager(gl) {
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  function createFullQuadVAO(program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, "a_position");

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return vao;
  }

  return {
    createFullQuadVAO,
  };
}
