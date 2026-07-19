#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_shape;
uniform vec2 u_resolution;
uniform vec4 u_targetRect;
uniform float u_alpha;
uniform int u_replace;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 point = v_texCoord * u_resolution;
  vec2 shapeCoord = (point - u_targetRect.xy) / u_resolution;
  vec4 imageColor = texture(u_image, v_texCoord);
  vec4 shapeColor = texture(u_shape, shapeCoord);
  float shapeAlpha = shapeColor.a;
  vec3 rgb = imageColor.rgb * (1.0 - shapeAlpha) + shapeColor.rgb;
  float alpha = imageColor.a + shapeAlpha * (1.0 - imageColor.a);
  if (u_replace == 1) {
    // 색 교체 모드: 도형이 완전히 덮는 픽셀은 (color, u_alpha)로 대체된다.
    // shapeAlpha = coverage * u_alpha 이므로 coverage로 되돌려 경계만 보간한다.
    float coverage = u_alpha > 0.0 ? min(shapeAlpha / u_alpha, 1.0) : 0.0;
    rgb = imageColor.rgb * (1.0 - coverage) + shapeColor.rgb;
    alpha = imageColor.a * (1.0 - coverage) + u_alpha * coverage;
  }
  outColor = vec4(rgb, alpha);
}
