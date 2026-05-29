import { createRectangle } from ".";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 사각형이 담긴 텍스처
const shapeTexture = gl.createTexture()!;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 실제 화면에 보여지는 텍스쳐
const resultTexture = gl.createTexture()!;

const rectangle = createRectangle(gl, {
  shapeTexture, // 이건 내부에서 막 지워도 되는 텍스쳐.
  imageTexture, // READ ONLY
  resultTexture,
  width,
  height,
});

rectangle.setColor([0, 0, 0, 1]);
rectangle.setWidth(12);

// 이걸 하면 shapeTexture가 수정되고, rect1은 shapeTexture를 배치할 targetRect임
// rect를 받으면 지금 그린 shapeTexture의 0,0,w,h의 부분을 캔버스의 x,y,w,h부분에 렌더링 해주세요.
// 내부적으로 마지막에 그린 shape와 width, height가 같으면, shapeTexture는 그리나 마나 똑같기때문에 최적화를 위해 그리지 않는다.
const rect1 = rectangle.create({ x: 10, y: 10, width: 200, height: 120 });

// 외부에서는 이 rect를 가지고 shapeTexture를 화면에 렌더링 시킬거고
render(); // 매 프레임마다 자동 수행되는 렌더함수

// apply하면 shapeTexture의 일부분을 imageTexture를 보고 resultTexture에 반영시키고, rect2는 실제 반영된 visibleRect임.
// 그리고 이 작업을 하면, shapeRender플래그가 꺼진다.
const rect2 = rectangle.apply(rect1);

// 반영시킨 이후에 외부에서 rect2부분을 가지고 스냅샷을 만들고 히스토리를 만든다.

// 대충 shapeTexture를 화면 어딘가에 렌더링한다는 함수
function render() {}

console.log(rect1, rect2);
