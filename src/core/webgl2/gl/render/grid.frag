#version 300 es
precision highp float;

uniform vec2 u_resolution; // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)
uniform vec2 u_pos; // 전체 스크린 크기 (픽셀 단위)
uniform vec2 u_screenSize; // 확대 배율 (값이 클수록 크게 보임)
uniform float u_magnification;
uniform float u_dpr;

in vec2 v_texCoord; // 풀스크린 정규화 좌표 (0~1)
out vec4 outColor;

void main() {
  // 1. magnification 반영된 "스케일된 스크린" 크기 계산
  vec2 scaledScreenSize = u_screenSize / u_magnification;
  vec2 canvasSize = u_resolution;

  // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
  vec2 scaledFragCoord = v_texCoord * scaledScreenSize;

  // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
  vec2 canvasPos = vec2(u_pos.x, u_pos.y);
  vec2 minCanvPos = canvasPos;
  vec2 maxCanvPos = canvasPos + canvasSize;

  // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
  if (
    scaledFragCoord.x < minCanvPos.x ||
    scaledFragCoord.x > maxCanvPos.x ||
    scaledFragCoord.y < minCanvPos.y ||
    scaledFragCoord.y > maxCanvPos.y
  ) {
    discard;
  }

  vec2 screenPx = v_texCoord * u_screenSize;

  float pixelStep = u_magnification * u_dpr; // device‑pixel 단위

  // 현재 프래그먼트의 캔버스 내 위치를 *스크린 픽셀* 단위로 환산
  // scaledFragCoord는 (스크린픽셀 / u_magnification) 단위이므로
  // 다시 u_magnification·u_dpr을 곱해주면 실제 스크린‑픽셀 좌표가 된다.
  vec2 canvasPx = (scaledFragCoord - minCanvPos) * u_magnification * u_dpr;

  float gridX = fract(canvasPx.x / pixelStep + 0.005);
  float gridY = fract(canvasPx.y / pixelStep + 0.005);

  // 임계값: 선 두께가 전체 격자 간격에서 차지하는 비율
  float threshold = 1.0 / u_magnification;

  bool isGridLine = gridX <= threshold || gridY <= threshold;

  // 격자 색상(시안)으로 덮어쓰기
  if (isGridLine) {
    vec3 rgb = vec3(1.0, 1.0, 1.0);
    float alpha = 0.2;
    outColor = vec4(rgb * alpha, alpha);
  }
}
