#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_shape;
uniform vec2 u_resolution;
uniform vec4 u_targetRect;

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
  outColor = vec4(rgb, alpha);
}
