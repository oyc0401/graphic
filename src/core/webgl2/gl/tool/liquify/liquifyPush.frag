#version 300 es
precision mediump float;

uniform sampler2D u_displacement;
uniform sampler2D u_ease_integral;
uniform sampler2D u_ease_mirror;

uniform vec2 u_resolution; // 화면크기, 해상도
uniform vec2 u_start;
uniform vec2 u_end;
uniform float u_radius;
uniform float u_strength;

in vec2 v_texCoord;
out vec2 outDisplacement;

// 샘플링을 통한 ease 함수 구현 (정확한 결과를 위해 precomputed 텍스처 사용)
float edgeCut(float x) {
  // x를 [0,1]로 가정하고, 1D 텍스처에서 선형 보간
  // flat
  //return sqrt(1.0 - x * x) * 0.5;
  // ease
  return texture(u_ease_integral, vec2(x, 0.5f)).r;
}

float sliceCut(float x) {
  // flat
  //return x;
  // ease
  return texture(u_ease_mirror, vec2(x, 0.5f)).r;
}

// getPower()와 유사한 로직: liquify 그리드 내에서 현재 픽셀의 영향력을 계산합니다.
float getPower(vec2 centerCoord, vec2 d, float radius) {
  // d의 길이
  float len = length(d);
  if (len == 0.0f) {
    return 1.0f;
  }
  // radius의 올림값 및 자주 쓰이는 상수
  float rCeil = ceil(radius);
  float doubleRCeil = 2.0f * rCeil;

  // sqrt를 줄이기위한 제곱 연산
  float squareR = radius * radius;

  // 그리드 크기 계산
  float gridWidth = abs(d.x) + 1.0f + doubleRCeil;
  float gridHeight = abs(d.y) + 1.0f + doubleRCeil;

  // 단위 벡터
  vec2 unit = d / len;

  // localStart 계산
  float localStartX = d.x > 0.0f ? rCeil : gridWidth - 1.0f - rCeil;
  float localStartY = d.y > 0.0f ? rCeil : gridHeight - 1.0f - rCeil;
  vec2 localStart = vec2(localStartX, localStartY);

  vec2 v = centerCoord - localStart;
  float t = dot(v, unit);

  // dist = v와 center(t * unit) 사이의 길이
  vec2 center = t * unit;
  vec2 d22 = v - center;
  float dist = length(d22);

  float percent = 1.0f;
  float power = 0.0f;

  // 1) (t > 0.0 && t < len)
  if (t > 0.0f && t < len) {
    float value = min(1.0f, dist / radius);
    float addValue = edgeCut(value);
    power = addValue * radius * 2.0f;
  }

  // 2) vLength < radius
  //float vLength;
  float dotV = dot(v, v);
  if (dotV < squareR) {
    float value = min(1.0f, dist / radius);
    float addValue = edgeCut(value);
    power = addValue * radius * 2.0f * percent;
  }

  // 3) eLength < radius
  vec2 eVec = v - d;
  // float eLength;
  float dotE = dot(eVec, eVec);
  if (dotE < squareR) {
    float value = min(1.0f, dist / radius);
    float addValue = edgeCut(value);
    power = addValue * radius * 2.0f * percent;
  }

  // 4) gradation 계산
  float originalCell = power;

  if (dotV < squareR) {
    float value = min(1.0f, dist / radius);
    float v2 = sqrt(1.0f - pow(value, 2.0f)) * radius * 2.0f * percent;

    float gradation = (radius + t) / radius / 2.0f;
    float result = (gradation - 0.5f) * (2.0f * radius / v2) + 0.5f;

    power -= originalCell * (1.0f - sliceCut(result));
  }

  if (dotE < squareR) {
    float value = min(1.0f, dist / radius);
    float v2 = sqrt(1.0f - pow(value, 2.0f)) * radius * 2.0f * percent;

    float gradation = (radius + (len - t)) / radius / 2.0f;
    float result = (gradation - 0.5f) * (2.0f * radius / v2) + 0.5f;

    power -= originalCell * (1.0f - sliceCut(result));
  }

  return power;
}

void main() {
  // 현재 픽셀의 기존 변위값
  vec2 value = texture(u_displacement, v_texCoord).xy;

  // 현재 픽셀 좌표 (ex: (250,360))
  vec2 pixel = v_texCoord * u_resolution;
  float ceiledRadius = ceil(u_radius);

  // 영역 계산
  vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
  vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);

  // 영향 영역 밖은 기존 변위값 그대로
  if (
    pixel.x < minCoord.x ||
    pixel.x > maxCoord.x ||
    pixel.y < minCoord.y ||
    pixel.y > maxCoord.y
  ) {
    outDisplacement = value;
    return;
  }

  // liquify 그리드 계산 (CPU 코드와 동일한 방식)
  vec2 d = u_end - u_start;
  float len = length(d);
  if (len == 0.0f) {
    // u_start == u_end라면 이동 없음
    outDisplacement = value;
    return;
  }

  vec2 unit = d / len;
  // gridSize와 startXY
  vec2 gridSize = abs(u_end - u_start) + vec2(1.0f) + vec2(2.0f * ceiledRadius);
  vec2 startXY = min(u_start, u_end) - vec2(ceiledRadius);

  // 좌표 역순 보정
  vec2 centerCoord = gridSize - 1.0f - pixel + startXY;
  float movementPower = getPower(centerCoord, d, u_radius);

  float diffVal = movementPower * u_strength * 0.5f;

  // 기존 변위 텍스처에서 보간
  vec2 displacedCoord = pixel - diffVal * unit;
  vec2 targetDisplace = displacedCoord / u_resolution;

  vec2 dispSample = texture(u_displacement, targetDisplace).xy;
  outDisplacement = dispSample - diffVal * unit;
}
