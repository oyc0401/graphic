#version 300 es

precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform vec2 u_resolution; // 캔버스(원본 텍스처) 해상도 (px)
uniform vec2 u_pos; // 캔버스의 왼쪽 상단 위치 (2D UI 좌표, px)
uniform vec2 u_screenSize; // 전체 스크린 크기 (px)
uniform float u_magnification; // 확대 배율 (값이 클수록 크게 보임)
uniform float u_transparent; // 1.0이면 배경을 반투명 회색(투명 표시)으로 그림

void main() {
  // 1. magnification을 반영한 "스케일된 스크린" 크기 계산
  vec2 scaledScreenSize = u_screenSize / u_magnification;
  vec2 canvasSize = u_resolution;

  // 2. 풀스크린 정규 좌표(v_texCoord)를 스케일된 픽셀 좌표로 변환
  vec2 scaledFragCoord = v_texCoord * scaledScreenSize;

  // 3. 2D UI 기준 (왼쪽 상단 기준)인 캔버스 영역을 스케일된 좌표계로 변환
  vec2 canvasPos = vec2(u_pos.x, u_pos.y);
  vec2 minCanvPos = canvasPos;
  vec2 maxCanvPos = canvasPos + canvasSize;

  // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 체크
  if (
    scaledFragCoord.x < minCanvPos.x ||
    scaledFragCoord.x > maxCanvPos.x ||
    scaledFragCoord.y < minCanvPos.y ||
    scaledFragCoord.y > maxCanvPos.y
  ) {
    discard;
  }

  // 5. 캔버스 영역 내부라면, 지정한 배경색을 출력
  if (u_transparent > 0.5) {
    // 반투명 회색 — 뒤의 그리드가 비쳐 투명처럼 보임 (premultiplied)
    vec3 rgb = vec3(0.0, 0.0, 0.0);
    float alpha = 0.04;
    outColor = vec4(rgb * alpha, alpha);
  } else {
    outColor = vec4(1.0, 1.0, 1.0, 1.0);
  }
}
