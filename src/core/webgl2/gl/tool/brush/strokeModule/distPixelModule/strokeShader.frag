#version 300 es
precision mediump float;

// 현재까지 그려진 알파 채널이 담긴 텍스처
uniform sampler2D u_pathMap;

// 선분 정보와 브러시 특성
uniform vec2 u_start;
uniform vec2 u_end;
uniform float u_radius;
uniform float u_alpha;

// 화면 해상도 (텍스처 좌표 → 픽셀 좌표 변환)
uniform vec2 u_resolution;

// 메인 텍스 좌표 & 출력
in vec2 v_texCoord;
out float outAlpha;

// 픽셀과 선분 사이의 최단거리 구하기
float distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float abLen2 = dot(ab, ab);
  if (abLen2 < 0.000001) {
    return length(p - a);
  }
  float t = dot(p - a, ab) / abLen2;
  t = clamp(t, 0.0, 1.0);
  vec2 closest = a + ab * t;
  return distance(p, closest);
}

void main() {
  // (1) 현재 픽셀에서 기존 알파값
  float basicAlpha = texture(u_pathMap, v_texCoord).r;

  // (2) 픽셀 중심 좌표 (픽셀 단위)
  vec2 pixelCoord = v_texCoord * u_resolution;

  // (3) 픽셀 중심 기준으로 경계 AA 없이 적용
  float distCenter = distanceToSegment(pixelCoord, u_start, u_end);
  float finalAlpha = distCenter <= u_radius ? u_alpha : 0.0;

  // (4) 기존 알파(basicAlpha)와 비교해 더 큰 값 적용
  outAlpha = max(basicAlpha, finalAlpha);
}
