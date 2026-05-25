import { createBrush } from ".";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 실제 화면에 보여지는 텍스쳐
const resultTexture = gl.createTexture()!;

const brush = createBrush(gl, {
  imageTexture,
  resultTexture,
  width,
  height,
});

brush.setAlpha(1);
brush.setBrushSize(1);
brush.setStrokeType(그 스트로크타입들)

// 이걸 하면 resultTexture이 수정됌
brush.start({ x: 10, y: 10 });
// 이걸 하면 resultTexture이 수정됌
brush.move({ x: 40, y: 24 });
// 이걸 하면 resultTexture이 수정됌
brush.move({ x: 72, y: 24 });
// 이걸하면 resultTexture을 imageTexture에 붙여넣기할거임.
// (imageTexture <- resultTexture)
// 그리고 이번 stroke의 Rect를 리턴함.
// 외부에서는 이 rect를 가지고 imageTexture를 기반으로 히스토리를 만들거임.
const strokeRect1 = brush.end(); // 그리고 내부적으로 alphamap을 지울거임

// cancel이 됐을 때
brush.start({ x: 120, y: 88 });
brush.move({ x: 180, y: 88 });
// 캔슬을 하면 히스토리는 안만드니깐 리턴없음

// 내부적으로 dirtyRect부분의 resultTexture <- imageTexture를 함.
brush.cancel();
