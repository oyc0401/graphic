#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform sampler2D u_mask;
uniform vec2 u_resolution;
uniform float u_radius;

in vec2 v_texCoord;
out vec4 outColor;

vec4 pixelMosaic(vec2 coord) {
  vec2 pixel = coord * u_resolution;
  float blockSize = max(1.0f, u_radius);
  vec2 blockOrigin = floor(pixel / blockSize) * blockSize;
  vec2 samplePixel = blockOrigin + vec2(blockSize * 0.5f);
  vec2 sampleCoord = clamp(samplePixel / u_resolution, vec2(0.0f), vec2(1.0f));
  return texture(u_source, sampleCoord);
}

void main() {
  float mask = texture(u_mask, v_texCoord).r;
  vec4 source = texture(u_source, v_texCoord);
  vec4 mosaic = pixelMosaic(v_texCoord);

  outColor = mix(source, mosaic, mask);
}
