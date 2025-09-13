#version 300 es
precision mediump float;
uniform sampler2D u_displacement;
uniform sampler2D u_source; // 원본 텍스처
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 value = texture(u_displacement, v_texCoord).xy;
  vec2 dif = value / u_resolution;

  vec2 target = v_texCoord + dif;

  // 범위 넘어가면 투명하게 되는건 나중에 구현이 더 필요함.
  // 테두리 보간 해야함!
  if (target.x < 0.0 || target.x > 1.0 || target.y < 0.0 || target.y > 1.0) {
    // 경계 외부는 투명색 반환
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    // vec4 newColor = texture(u_source, target);
    // float newAlpha = newColor.a;
    // outColor = vec4(newColor.rgb, newAlpha);
    outColor = texture(u_source, target);
    // outColor = vec4(0.0,1.0,0.0,value.y/8.0);
  }
}
