#version 300 es
precision highp float;

uniform sampler2D u_displacement;
uniform sampler2D u_primitive;

uniform vec2 u_resolution;
uniform vec2 u_start;
uniform vec2 u_end;
uniform float u_radius;
uniform float u_strength;

in vec2 v_texCoord;
out vec2 outDisplacement;

// vec2 외적 스칼라값. direction이 단위 벡터이면 stroke 직선까지의 수직 거리 계산에 쓴다.
float cross2(vec2 a, vec2 b) {
  return a.x * b.y - a.y * b.x;
}

// u_primitive는 P(U, X) = integral(0..U) K(sqrt(X^2 + u^2)) du 를 담은 2D lookup이다.
// z의 부호로 적분 방향을 표현해서 유한 선분 적분을 P_signed(z1, X) - P_signed(z0, X)로 만든다.
float primitive(float z, float x) {
  float signValue = z < 0.0f ? -1.0f : 1.0f;

  // K는 radius 밖에서 0이므로 U >= 1 이후는 plateau로 clamp한다.
  float u = clamp(abs(z), 0.0f, 1.0f);
  return signValue * texture(u_primitive, vec2(u, x)).r;
}

// 현재 픽셀이 segment에서 받는 정규화 영향력. 중앙선은 거의 1, 반지름 가장자리는 거의 0이다.
// signed primitive 차이로 선분의 시작/끝 cap까지 같은 식에서 처리한다.
float strokePower(vec2 pixel, vec2 start, vec2 end, float radius) {
  vec2 segment = end - start;
  float len = length(segment);
  if (len == 0.0f || radius <= 0.0f) {
    return 0.0f;
  }

  vec2 direction = segment / len;
  vec2 local = pixel - start;

  // start에서 픽셀 투영점까지의 segment 축 방향 거리. 아직 픽셀 단위다.
  float along = dot(local, direction);

  // stroke 직선까지의 수직 거리를 radius로 나눠 lookup의 X 좌표로 만든다.
  float perpendicular = abs(cross2(local, direction));
  float x = perpendicular / radius;

  // 브러시 반지름 밖은 영향이 없다.
  if (x >= 1.0f) {
    return 0.0f;
  }

  // 선분 [0, len]을 픽셀 투영 위치 기준의 radius 정규화 구간 [z0, z1]로 바꾼다.
  // 유한 선분 적분은 P_signed(z1, x) - P_signed(z0, x)다.
  float z0 = -along / radius;
  float z1 = (len - along) / radius;
  return primitive(z1, x) - primitive(z0, x);
}

void main() {
  // 현재 픽셀의 기존 변위값. 이번 segment가 닿지 않으면 그대로 반환한다.
  vec2 value = texture(u_displacement, v_texCoord).xy;

  // 텍스처 좌표를 이미지 픽셀 좌표로 변환해 zoom과 무관한 stroke 계산을 한다.
  vec2 pixel = v_texCoord * u_resolution;
  float ceiledRadius = ceil(u_radius);

  // segment bounding box를 radius만큼 확장한 영역 밖은 빠르게 제외한다.
  vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
  vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);

  if (pixel.x < minCoord.x || pixel.x > maxCoord.x || pixel.y < minCoord.y || pixel.y > maxCoord.y) {
    outDisplacement = value;
    return;
  }

  // 최종 변위 벡터 방향을 구한다.
  vec2 segment = u_end - u_start;
  float len = length(segment);
  if (len == 0.0f) {
    outDisplacement = value;
    return;
  }

  vec2 unit = segment / len;

  // power는 정규화 영향력이고 radius를 곱하면 픽셀 이동량이 된다.
  // 0.5는 기존 픽셀유동화 도구의 체감 세기를 유지하기 위한 계수다.
  float power = strokePower(pixel, u_start, u_end, u_radius);
  float diffVal = power * u_radius * u_strength * 0.5f;

  // Backward warping: +unit으로 밀려면 현재 픽셀은 이전 변위장의 pixel - movement를 샘플링한다.
  // forward splatting의 구멍 문제를 피하고 선형 필터링으로 변위를 부드럽게 합성한다.
  vec2 displacedCoord = pixel - diffVal * unit;
  vec2 targetDisplace = displacedCoord / u_resolution;
  vec2 dispSample = texture(u_displacement, targetDisplace).xy;

  // 이전 변위에 이번 segment 이동을 합성한다.
  // 렌더 단계가 source를 texCoord + displacement/resolution에서 샘플링하므로 음수로 누적한다.
  outDisplacement = dispSample - diffVal * unit;
}
