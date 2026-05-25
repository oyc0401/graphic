#version 300 es

precision mediump float;
uniform sampler2D u_pathMap;
uniform sampler2D u_source;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
  float value = texture(u_pathMap, v_texCoord).r;
  vec4 imageColor = texture(u_source, v_texCoord);
  float factor = 1.0 - value;
  outColor = vec4(imageColor.rgb * factor, imageColor.a * factor);
}
