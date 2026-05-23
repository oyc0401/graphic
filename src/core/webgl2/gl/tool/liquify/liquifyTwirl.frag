#version 300 es
precision highp float;

uniform sampler2D u_displacement;

uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_strength;
uniform float u_direction;

in vec2 v_texCoord;
out vec2 outDisplacement;

mat2 rotationMatrix(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float falloff(float t) {
  float x = clamp(t, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}

void main() {
  vec2 value = texture(u_displacement, v_texCoord).xy;
  vec2 pixel = v_texCoord * u_resolution;
  vec2 local = pixel - u_center;
  float dist = length(local);

  if (u_radius <= 0.0 || dist >= u_radius) {
    outDisplacement = value;
    return;
  }

  float power = falloff(1.0 - dist / u_radius);
  float angle = u_direction * u_strength * power * 0.12;

  // Backward warping: 현재 픽셀은 반대 방향으로 회전한 이전 변위장을 샘플링한다.
  vec2 samplePixel = u_center + rotationMatrix(-angle) * local;
  vec2 sampleTexCoord = samplePixel / u_resolution;

  if (
    sampleTexCoord.x < 0.0 ||
    sampleTexCoord.x > 1.0 ||
    sampleTexCoord.y < 0.0 ||
    sampleTexCoord.y > 1.0
  ) {
    outDisplacement = value;
    return;
  }

  vec2 sampleDisplacement = texture(u_displacement, sampleTexCoord).xy;
  outDisplacement = sampleDisplacement + samplePixel - pixel;
}
