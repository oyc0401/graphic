#version 300 es

precision mediump float;

uniform sampler2D u_source;
uniform sampler2D u_alphaMap;
uniform vec2 u_resolution;
uniform vec4 u_color;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec4 imageColor = texture(u_source, v_texCoord);
  float shapeAlpha = texture(u_alphaMap, v_texCoord).r * u_color.a;
  vec3 premultShape = u_color.rgb * shapeAlpha;
  vec3 blendedRGB = imageColor.rgb * (1.0 - shapeAlpha) + premultShape;
  float blendedAlpha = imageColor.a + shapeAlpha * (1.0 - imageColor.a);
  outColor = vec4(blendedRGB, blendedAlpha);
}
