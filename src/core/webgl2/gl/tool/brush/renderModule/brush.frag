#version 300 es

precision mediump float;
uniform sampler2D u_pathMap;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec3 u_color;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
  float value = texture(u_pathMap, v_texCoord).r;
  vec4 brushColor = vec4(u_color, value);
  vec4 imageColor = texture(u_source, v_texCoord);
  vec3 premultBrush = brushColor.rgb * brushColor.a;
  vec3 premultImage = imageColor.rgb;
  vec3 blendedRGB = premultImage * (1.0 - brushColor.a) + premultBrush;
  float blendedAlpha = imageColor.a + brushColor.a * (1.0 - imageColor.a);
  outColor = vec4(blendedRGB, blendedAlpha);
}
