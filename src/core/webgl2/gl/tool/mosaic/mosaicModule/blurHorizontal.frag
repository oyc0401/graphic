#version 300 es
precision highp float;

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform int u_blurRadius;

in vec2 v_texCoord;
out vec4 outColor;

const int MAX_BLUR_SAMPLES = 64;

void main() {
  vec2 texel = 1.0f / u_resolution;
  int radius = max(1, u_blurRadius);
  int stride = max(1, int(ceil(float(radius) / float(MAX_BLUR_SAMPLES))));
  float sigma = max(1.0f, float(radius) * 0.35f);

  vec3 color = vec3(0.0f);
  float alpha = 0.0f;
  float totalWeight = 0.0f;

  for (int x = -MAX_BLUR_SAMPLES; x <= MAX_BLUR_SAMPLES; x++) {
    int sampleDistance = x * stride;
    if (abs(sampleDistance) > radius) {
      continue;
    }

    float distance = float(sampleDistance);
    float weight = exp(-(distance * distance) / (2.0f * sigma * sigma));
    vec2 sampleCoord = clamp(
      v_texCoord + vec2(distance * texel.x, 0.0f),
      vec2(0.0f),
      vec2(1.0f)
    );

    vec4 sampleColor = texture(u_source, sampleCoord);
    color += sampleColor.rgb * sampleColor.a * weight;
    alpha += sampleColor.a * weight;
    totalWeight += weight;
  }

  float outAlpha = alpha / totalWeight;
  vec3 outRgb = alpha > 0.0f ? color / alpha : vec3(0.0f);
  outColor = vec4(outRgb, outAlpha);
}
