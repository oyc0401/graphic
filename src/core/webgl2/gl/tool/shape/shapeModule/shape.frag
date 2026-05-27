#version 300 es

precision mediump float;

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform vec4 u_shapeRect;
uniform float u_strokeWidth;
uniform int u_shapeType;

in vec2 v_texCoord;
out vec4 outColor;

float rectangleAlpha(vec2 point, vec2 origin, vec2 size, float strokeWidth) {
  float halfStroke = strokeWidth * 0.5;
  vec2 outerOrigin = origin - vec2(halfStroke);
  vec2 outerMaxPos = origin + size + vec2(halfStroke);
  vec2 innerOrigin = origin + vec2(halfStroke);
  vec2 innerMaxPos = origin + size - vec2(halfStroke);
  bool insideOuter =
    point.x >= outerOrigin.x &&
    point.y >= outerOrigin.y &&
    point.x < outerMaxPos.x &&
    point.y < outerMaxPos.y;
  bool insideInner =
    point.x >= innerOrigin.x &&
    point.y >= innerOrigin.y &&
    point.x < innerMaxPos.x &&
    point.y < innerMaxPos.y;

  return insideOuter && !insideInner ? 1.0 : 0.0;
}

float ellipseAlpha(vec2 point, vec2 origin, vec2 size, float strokeWidth) {
  vec2 radius = size * 0.5;
  if (radius.x <= 0.0 || radius.y <= 0.0) {
    return 0.0;
  }

  vec2 center = origin + radius;
  float halfStroke = strokeWidth * 0.5;
  vec2 outerRadius = radius + vec2(halfStroke);
  vec2 innerRadius = max(radius - vec2(halfStroke), vec2(0.0));
  float outerDistance = length((point - center) / outerRadius);
  float innerDistance = innerRadius.x <= 0.0 || innerRadius.y <= 0.0
    ? 2.0
    : length((point - center) / innerRadius);

  return outerDistance <= 1.0 && innerDistance >= 1.0 ? 1.0 : 0.0;
}

void main() {
  vec4 imageColor = texture(u_source, v_texCoord);
  vec2 point = v_texCoord * u_resolution;
  vec2 origin = u_shapeRect.xy;
  vec2 size = u_shapeRect.zw;
  float alpha = 0.0;

  if (u_shapeType == 0) {
    alpha = rectangleAlpha(point, origin, size, u_strokeWidth);
  } else {
    alpha = ellipseAlpha(point, origin, size, u_strokeWidth);
  }

  float shapeAlpha = u_color.a * alpha;
  vec3 premultShape = u_color.rgb * shapeAlpha;
  vec3 blendedRGB = imageColor.rgb * (1.0 - shapeAlpha) + premultShape;
  float blendedAlpha = imageColor.a + shapeAlpha * (1.0 - imageColor.a);
  outColor = vec4(blendedRGB, blendedAlpha);
}
