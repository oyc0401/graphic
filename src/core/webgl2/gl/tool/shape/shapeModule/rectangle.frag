#version 300 es

precision mediump float;

uniform vec2 u_resolution;
uniform vec4 u_color;
uniform float u_strokeWidth;

in vec2 v_texCoord;
out vec4 outColor;

float rectangleAlpha(vec2 point, vec2 size, float strokeWidth) {
  float stroke = min(strokeWidth, min(size.x, size.y));
  vec2 innerOrigin = vec2(stroke);
  vec2 innerMaxPos = size - vec2(stroke);
  bool insideOuter =
    point.x >= 0.0 &&
    point.y >= 0.0 &&
    point.x < size.x &&
    point.y < size.y;
  bool insideInner =
    point.x >= innerOrigin.x &&
    point.y >= innerOrigin.y &&
    point.x < innerMaxPos.x &&
    point.y < innerMaxPos.y;

  return insideOuter && !insideInner ? 1.0 : 0.0;
}

void main() {
  vec2 point = v_texCoord * u_resolution;
  float alpha = rectangleAlpha(point, u_resolution, u_strokeWidth);
  float shapeAlpha = u_color.a * alpha;
  outColor = vec4(u_color.rgb * shapeAlpha, shapeAlpha);
}
