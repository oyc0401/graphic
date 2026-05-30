const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

// 원본이미지가 담긴 텍스쳐
const texture = gl.createTexture()!;

// 해당 텍스쳐는 정확히 그대로 화면 어딘가에 보여집니다.
const renderTexture = gl.createTexture()!;

// 마스크는 외부에서 소유하고, render 모듈은 이 텍스쳐를 읽기만 합니다.
const maskTexture = gl.createTexture()!;

const brushRender = BrushRenderModule(gl, {
  imageTexture: texture,
  resultTexture: renderTexture,
  maskTexture,
  width,
  height,
});

brushRender.setColor([1, 1, 1, 1]);
setMode("eraser");

// 이걸 하면 렌더링됌.
brushRender.render({ x, y, width, height });
