#version 300 es
precision highp float;

uniform sampler2D u_source; // 원본 텍스처

uniform vec2 u_resolution; // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)
uniform vec2 u_pos; // 전체 스크린 크기 (픽셀 단위)
uniform vec2 u_screenSize; // 확대 배율 (값이 클수록 크게 보임)
uniform float u_magnification;

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

  // 5.) 캔버스 영역 내의 상대 좌표 (0~1) 계산
  vec2 local = (scaledFragCoord - minCanvPos) / canvasSize;

  // 6. 원본 텍스처에서 local 좌표로 색상을 샘플링
  vec4 imageColor = texture(u_source, local);
  outColor = vec4(imageColor.rgb, imageColor.a);
}
