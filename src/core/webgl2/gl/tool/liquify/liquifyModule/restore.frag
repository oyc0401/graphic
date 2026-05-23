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

float cross2(vec2 a, vec2 b) {
  return a.x * b.y - a.y * b.x;
}

float primitive(float z, float x) {
  float signValue = z < 0.0f ? -1.0f : 1.0f;
  float u = clamp(abs(z), 0.0f, 1.0f);
  return signValue * texture(u_primitive, vec2(u, x)).r;
}

float strokePower(vec2 pixel, vec2 start, vec2 end, float radius) {
  vec2 segment = end - start;
  float len = length(segment);
  if (radius <= 0.0f) {
    return 0.0f;
  }
  if (len == 0.0f) {
    float x = length(pixel - start) / radius;
    if (x >= 1.0f) {
      return 0.0f;
    }
    return primitive(1.0f, x);
  }

  vec2 direction = segment / len;
  vec2 local = pixel - start;
  float along = dot(local, direction);
  float perpendicular = abs(cross2(local, direction));
  float x = perpendicular / radius;

  if (x >= 1.0f) {
    return 0.0f;
  }

  float z0 = -along / radius;
  float z1 = (len - along) / radius;
  return primitive(z1, x) - primitive(z0, x);
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

  float power = min(strokePower(pixel, u_start, u_end, u_radius) * 2.0f, 1.0f);
  float restoreAmount = clamp(power * u_strength * 0.5f, 0.0f, 1.0f);
  outDisplacement = mix(value, vec2(0.0f), restoreAmount);
}
