import { createShape } from ".";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 실제 화면에 보여지는 텍스쳐
const resultTexture = gl.createTexture()!;

const shape = createShape(gl, {
  imageTexture,
  resultTexture,
  width,
  height,
});

// 이걸 하면 resultTexture가 수정됌
const rect1 = shape.createRectangle(
  { x: 10, y: 10, width: 200, height: 120 },
  {
    color: [0, 0, 0, 1],
    strokeWidth: 8,
  },
);

// 이걸 하면 resultTexture가 수정됌
const rect2 = shape.createEllipse(
  { x: 260, y: 80, width: 180, height: 140 },
  {
    color: [1, 0, 0, 0.8],
    strokeWidth: 12,
  },
);

// 외부에서는 이 rect를 가지고 resultTexture를 기반으로 히스토리를 만들거임.

// 대충 resultTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, resultTexture);

  // resultTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

console.log(rect1, rect2);
render();
