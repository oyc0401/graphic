#version 300 es

precision highp float;

uniform sampler2D u_selection_source;
uniform sampler2D u_selection;

uniform vec2 u_pos; // 전체 화면 기준: 캔버스 왼쪽 상단
uniform vec2 u_resolution; // 실제 캔버스 크기 (px)
uniform vec2 u_screenSize; // 전체 스크린 크기 (px)
uniform float u_magnification;

uniform float u_max_size;
uniform vec2 u_selectionPos; // 선택 영역 위치 (캔버스 내부 기준)
uniform vec2 u_selectionSize; // 선택 영역 크기

in vec2 v_texCoord; // 풀스크린 정규화 좌표 (0~1)
out vec4 outColor;

void main() {
  // 1. magnification 반영된 "스케일된 스크린" 크기 계산
  vec2 scaledScreenSize = u_screenSize / u_magnification;
  vec2 canvasSize = u_resolution;

  // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
  vec2 scaledFragCoord = v_texCoord * scaledScreenSize;

  // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
  vec2 selectionPos = vec2(
    u_pos.x + u_selectionPos.x,
    u_pos.y + u_selectionPos.y
  );
  vec2 minSelPos = selectionPos;
  vec2 maxSelPos = selectionPos + u_selectionSize;

  // 현재 픽셀이 selection 안에 있지 않으면 버림
  if (
    scaledFragCoord.x < minSelPos.x ||
    scaledFragCoord.x > maxSelPos.x ||
    scaledFragCoord.y < minSelPos.y ||
    scaledFragCoord.y > maxSelPos.y
  ) {
    discard;
  }

  // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
  vec2 canvasPos = vec2(u_pos.x, u_pos.y);
  vec2 minCanvPos = canvasPos;
  vec2 maxCanvPos = canvasPos + canvasSize;
  bool isOut = false;

  // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
  if (
    scaledFragCoord.x < minCanvPos.x ||
    scaledFragCoord.x > maxCanvPos.x ||
    scaledFragCoord.y < minCanvPos.y ||
    scaledFragCoord.y > maxCanvPos.y
  ) {
    isOut = true;
  }

  // 선택영역 내에 있으면 텍스처 좌표 계산
  vec2 local = (scaledFragCoord - minSelPos) / u_selectionSize;

  if (u_selectionSize.x > 2048.0 || u_selectionSize.y > 2048.0) {
    // 화면이 엄청 크면 걍 근사로
    vec4 imageColor = texture(u_selection_source, local);
    if (isOut) {
      float alpha = 0.25;
      outColor = vec4(imageColor.rgb * alpha, imageColor.a * alpha);
      return;
    }
    outColor = vec4(imageColor.rgb, imageColor.a);
    return;
  }

  // 이제 변환을 해야하는데, 현재 100px너비에서의 0.5 라면 50px인데, 이걸 8192텍스쳐 기준으로 잡으면
  vec2 newLocal = local * u_selectionSize / u_max_size;
  vec4 imageColor = texture(u_selection, newLocal);
  if (isOut) {
    float alpha = 0.25;
    outColor = vec4(imageColor.rgb * alpha, imageColor.a * alpha);
    return;
  }
  outColor = vec4(imageColor.rgb, imageColor.a);
}
