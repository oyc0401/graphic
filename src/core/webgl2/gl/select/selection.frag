#version 300 es
#pragma vscode_glsllint_stage: frag
precision highp float;

uniform sampler2D u_selection_source;
uniform sampler2D u_selection;
uniform sampler2D u_source;

uniform vec2 u_resolution;      // 실제 캔버스 크기 (px)

uniform vec2 u_selectionPos;    // 선택 영역 위치 (캔버스 내부 기준)
uniform vec2 u_selectionSize;   // 선택 영역 크기
uniform float u_max_size;

in vec2 v_texCoord;             // 풀스크린 정규화 좌표 (0~1)
out vec4 outColor;

void main() {
  vec2 scaledScreenSize = u_resolution;

  // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
  vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
  vec2 size = u_selectionSize;

  // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
  vec2 selectionPos = vec2(u_selectionPos.x, u_selectionPos.y);
  vec2 minPos = selectionPos;
  vec2 maxPos = selectionPos + size;

  // 현재 픽셀이 selection 안에 있지 않으면 버림
  if (
    scaledFragCoord.x < minPos.x || scaledFragCoord.x > maxPos.x ||
    scaledFragCoord.y < minPos.y || scaledFragCoord.y > maxPos.y
  ) {
    discard;
  }

  // 선택영역 내에 있으면 텍스처 좌표 계산
  vec2 local = (scaledFragCoord - minPos) / size;
  vec4 selectionColor;

  if(u_selectionSize.x > 2048.0 || u_selectionSize.y > 2048.0){
    // 화면이 엄청 크면 걍 근사로
    selectionColor = texture(u_selection_source, local);    // 프리
  } else {
    vec2 newLocal = local * size / u_max_size;
    selectionColor = texture(u_selection, newLocal);    // 프리
  }

  vec4 imageColor = texture(u_source, v_texCoord);      // 프리

  float srcA = selectionColor.a;
  float dstA = imageColor.a;

  float outA = srcA + dstA * (1.0 - srcA);
  vec3 outRGB = selectionColor.rgb + imageColor.rgb * (1.0 - srcA);

  outColor = vec4(outRGB, outA);
}