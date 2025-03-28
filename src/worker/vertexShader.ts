import { createShader } from "./glHelper";

const fullQuadVertexShaders = new Map();

/**
 * in vec2 a_position;
 */
export function getFullQuadShader(gl) {
  if (fullQuadVertexShaders.has(gl)) {
    return fullQuadVertexShaders.get(gl);
  }

  const vertexShader = makeFullQuadVertexShader(gl);
  fullQuadVertexShaders.set(gl, vertexShader);

  return vertexShader;
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

export function enable_a_position(gl, program) {
  let posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
}
