#version 300 es

precision highp float;

uniform sampler2D u_shape;

uniform vec2 u_pos;
uniform vec2 u_resolution;
uniform vec2 u_screenSize;
uniform float u_magnification;

uniform vec2 u_shapePos;
uniform vec2 u_shapeSize;

in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 scaledScreenSize = u_screenSize / u_magnification;
  vec2 scaledFragCoord = v_texCoord * scaledScreenSize;

  vec2 shapePos = vec2(u_pos.x + u_shapePos.x, u_pos.y + u_shapePos.y);
  vec2 minShapePos = shapePos;
  vec2 maxShapePos = shapePos + u_shapeSize;

  if (
    scaledFragCoord.x < minShapePos.x ||
    scaledFragCoord.x > maxShapePos.x ||
    scaledFragCoord.y < minShapePos.y ||
    scaledFragCoord.y > maxShapePos.y
  ) {
    discard;
  }

  vec2 canvasPos = vec2(u_pos.x, u_pos.y);
  vec2 minCanvPos = canvasPos;
  vec2 maxCanvPos = canvasPos + u_resolution;
  bool isOut = false;

  if (
    scaledFragCoord.x < minCanvPos.x ||
    scaledFragCoord.x > maxCanvPos.x ||
    scaledFragCoord.y < minCanvPos.y ||
    scaledFragCoord.y > maxCanvPos.y
  ) {
    isOut = true;
  }

  vec2 local = scaledFragCoord - minShapePos;
  vec2 shapeCoord = local / u_resolution;
  vec4 shapeColor = texture(u_shape, shapeCoord);
  if (shapeColor.a <= 0.0) {
    discard;
  }

  if (isOut) {
    float alpha = 0.25;
    outColor = vec4(shapeColor.rgb * alpha, shapeColor.a * alpha);
    return;
  }

  outColor = shapeColor;
}
