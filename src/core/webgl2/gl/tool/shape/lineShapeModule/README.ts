import { createLineShape } from ".";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 직선이 담긴 텍스처
const shapeTexture = gl.createTexture()!;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 실제 화면에 보여지는 텍스쳐
const resultTexture = gl.createTexture()!;

const lineShape = createLineShape(gl, {
  shapeTexture, // 이건 내부에서 막 지워도 되는 텍스쳐.
  imageTexture,
  resultTexture,
  width,
  height,
});

lineShape.setColor([0, 0, 0, 1]);
lineShape.setWidth(8);

// 이걸 하면 shapeTexture가 수정됌
const rect1 = lineShape.create(
  { x: 10, y: 10 },
  { x: 220, y: 120 },
);

// 외부에서는 이 rect를 가지고 shapeTexture를 화면에 렌더링 시킬거고
render(); // 매 프레임마다 자동 수행되는 렌더함수

// apply하면 shapeTexture의 일부분을 imageTexture를 보고 resultTexture에 반영시킴.
const rect2 = lineShape.apply(
  { x: 10, y: 10 },
  { x: 220, y: 120 },
);

// 반영시킨 이후에 외부에서 rect2부분을 가지고 스냅샷을 만들고 히스토리를 만든다.

// 대충 resultTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, resultTexture);

  // resultTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

console.log(rect1, rect2);
