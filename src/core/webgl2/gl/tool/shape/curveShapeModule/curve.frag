#version 300 es

precision mediump float;

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec4 u_color;
uniform vec2 u_p1;
uniform vec2 u_p2;
uniform vec2 u_c1;
uniform vec2 u_c2;
uniform float u_strokeWidth;

in vec2 v_texCoord;
out vec4 outColor;

float segmentDistance(vec2 point, vec2 start, vec2 end) {
  vec2 segment = end - start;
  float lengthSq = dot(segment, segment);
  if (lengthSq == 0.0) {
    return length(point - start);
  }

  float t = clamp(dot(point - start, segment) / lengthSq, 0.0, 1.0);
  return length(point - (start + segment * t));
}

vec2 cubicBezier(float t) {
  float inv = 1.0 - t;
  return
    inv * inv * inv * u_p1 +
    3.0 * inv * inv * t * u_c1 +
    3.0 * inv * t * t * u_c2 +
    t * t * t * u_p2;
}

float curveDistance(vec2 point) {
  float distanceValue = 100000.0;
  vec2 previous = u_p1;

  for (int i = 1; i <= 100; i++) {
    float t = float(i) / 100.0;
    vec2 current = cubicBezier(t);
    distanceValue = min(distanceValue, segmentDistance(point, previous, current));
    previous = current;
  }

  return distanceValue;
}

void main() {
  vec4 imageColor = texture(u_source, v_texCoord);
  vec2 point = v_texCoord * u_resolution;
  float halfStroke = u_strokeWidth * 0.5;
  float distanceValue = curveDistance(point);
  float shapeAlpha = distanceValue <= halfStroke ? u_color.a : 0.0;
  vec3 premultShape = u_color.rgb * shapeAlpha;
  vec3 blendedRGB = imageColor.rgb * (1.0 - shapeAlpha) + premultShape;
  float blendedAlpha = imageColor.a + shapeAlpha * (1.0 - imageColor.a);
  outColor = vec4(blendedRGB, blendedAlpha);
}
