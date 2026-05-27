import { createShape } from ".";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 도형이 담긴 텍스처
const shapeTexture = gl.createTexture()!;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 실제 화면에 보여지는 텍스쳐
const resultTexture = gl.createTexture()!;

const shape = createShape(gl, {
  shapeTexture, // 이건 내부에서 막 지워도 되는 텍스쳐.
  imageTexture,
  resultTexture,
  width,
  height,
});

shape.setColor([0, 0, 0, 1]);
shape.setWidth(12);

// 이걸 하면 shapeTexture가 수정됌
// rect를 받으면 지금 그린 shapeTexture의 0,0,w,h의 부분을 캔버스의 x,y,w,h부분에 렌더링 해주세요.
// 내부적으로 이전에 그린 width, height가 같으면, shapeTexture는 그리나 마나 똑같기때문에 최적화를 위해 그리지 않는다.
const rect1 = shape.createRectangle({ x: 10, y: 10, width: 200, height: 120 });

// rect를 받으면 지금 그린 shapeTexture의 0,0,w,h의 부분을 캔버스의 x,y,w,h부분에 렌더링 해주세요.
// 이걸 하면 shapeTexture가 수정됌
const rect2 = shape.createEllipse({ x: 260, y: 80, width: 180, height: 140 });

// 외부에서는 이 rect를 가지고 shapeTexture를 화면에 렌더링 시킬거고
render(); // 매 프레임마다 자동 수행되는 렌더함수

// apply하면 shapeTexture의 일부분을 원본텍스쳐와 소스텍스쳐에 반영시킴.
const rect3 = shape.apply(x, y, w, h); // rect3은 굳이 안해도 되는데, 다른 모듈과의 통일성을 위해서 일단 만듬.

// 반영시킨 이후에 외부에서 rect3부분을 가지고 스냅샷을 만들고 히스토리를 만든다.

// 대충 shapeTexture를 화면 어딘가에 렌더링한다는 함수
function render() {}
