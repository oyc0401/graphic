#version 300 es

precision mediump float;

uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_strokeWidth;

in vec2 v_texCoord;
out vec4 outColor;

float ellipseAlpha(vec2 point, vec2 size, float strokeWidth) {
  vec2 radius = size * 0.5;
  if (radius.x <= 0.0 || radius.y <= 0.0) {
    return 0.0;
  }

  vec2 center = radius;
  float stroke = min(strokeWidth, min(radius.x, radius.y));
  vec2 outerRadius = radius;
  vec2 innerRadius = max(radius - vec2(stroke), vec2(0.0));
  float outerDistance = length((point - center) / outerRadius);
  float innerDistance = innerRadius.x <= 0.0 || innerRadius.y <= 0.0
    ? 2.0
    : length((point - center) / innerRadius);

  return outerDistance <= 1.0 && innerDistance >= 1.0 ? 1.0 : 0.0;
}

void main() {
  vec2 point = v_texCoord * u_resolution;
  float alpha = ellipseAlpha(point, u_resolution, u_strokeWidth);
  float shapeAlpha = u_color.a * alpha;
  outColor = vec4(u_color.rgb * shapeAlpha, shapeAlpha);
}
