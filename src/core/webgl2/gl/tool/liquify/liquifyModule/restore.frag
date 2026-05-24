#version 300 es
precision highp float;

uniform sampler2D u_displacement;

uniform vec2 u_resolution;
uniform vec2 u_start;
uniform vec2 u_end;
uniform float u_radius;
uniform float u_strength;

in vec2 v_texCoord;
out vec2 outDisplacement;

float easeInOutSine(float x) {
  float clamped = clamp(x, 0.0f, 1.0f);
  return -(cos(3.141592653589793f * clamped) - 1.0f) * 0.5f;
}

float ease(float x) {
  float clamped = clamp(x, 0.0f, 1.0f);
  if (clamped >= 0.5f) {
    return 1.0f;
  }

  return easeInOutSine(clamped * 2.0f);
}

float strokePower(vec2 pixel, vec2 start, vec2 end, float radius) {
  vec2 segment = end - start;
  if (radius <= 0.0f) {
    return 0.0f;
  }

  float lenSq = dot(segment, segment);
  float t = lenSq == 0.0f ? 0.0f : clamp(dot(pixel - start, segment) / lenSq, 0.0f, 1.0f);
  vec2 closest = start + segment * t;
  float distanceRatio = length(pixel - closest) / radius;

  if (distanceRatio >= 1.0f) {
    return 0.0f;
  }

  return ease(1.0f - distanceRatio);
}

void main() {
  vec2 value = texture(u_displacement, v_texCoord).xy;
  vec2 pixel = v_texCoord * u_resolution;
  float ceiledRadius = ceil(u_radius);

  vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
  vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);

  if (pixel.x < minCoord.x || pixel.x > maxCoord.x || pixel.y < minCoord.y || pixel.y > maxCoord.y) {
    outDisplacement = value;
    return;
  }

  float power = strokePower(pixel, u_start, u_end, u_radius);
  float restoreAmount = clamp(power * u_strength, 0.0f, 1.0f);
  outDisplacement = mix(value, vec2(0.0f), restoreAmount);
}
