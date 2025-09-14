#version 300 es

precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_pos;
uniform vec2 u_screenSize;
uniform float u_magnification;
uniform float u_dpr;

void main() {
  // 실제 픽셀 좌표
  float px = v_texCoord.x * u_screenSize.x / u_dpr;
  float py = v_texCoord.y * u_screenSize.y / u_dpr;

  float cellSize = 16.0; // 셀 크기
  float borderSize = 1.0; // 테두리 두께

  float modX = mod(px, cellSize);
  float modY = mod(py, cellSize);

  // 경계선 근처면 밝은 선 색
  if (modX < borderSize || modY < borderSize) {
    outColor = vec4(0.89, 0.89, 0.89, 1.0); // 테두리
  } else {
    outColor = vec4(0.91, 0.91, 0.91, 1.0); // 셀 내부
  }
}
