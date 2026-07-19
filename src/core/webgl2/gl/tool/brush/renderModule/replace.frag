#version 300 es

precision mediump float;
uniform sampler2D u_pathMap;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec4 u_color;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
  // replace 모드에서는 strokeModule에 alpha 1을 넣으므로 pathMap 값이 순수 coverage다.
  // coverage가 1인 픽셀은 정확히 (u_color * a, a)로 교체된다. a=0이면 투명으로 교체(지우기)된다.
  float coverage = texture(u_pathMap, v_texCoord).r;
  vec4 imageColor = texture(u_source, v_texCoord);
  vec3 rgb = imageColor.rgb * (1.0 - coverage) + u_color.rgb * u_color.a * coverage;
  float alpha = imageColor.a * (1.0 - coverage) + u_color.a * coverage;
  outColor = vec4(rgb, alpha);
}
