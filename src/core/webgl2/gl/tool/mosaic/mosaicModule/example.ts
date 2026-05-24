const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 모자이크 결과가 기록되는 텍스처
const resultTexture = gl.createTexture()!;

const mosaic = createMosaic(gl, {
  imageTexture,
  resultTexture,
  width,
  height,
});

mosaic.setRadius(50);
mosaic.setStrength(0.5); // 이걸 하면, 모자이크 강도가 바뀌고, 기존 알파맵 영역이 다시 렌더링 대상이 됌
mosaic.render(); // 이걸 하면 resultTexture의 dirtyRect 영역이 모자이크로 수정됌

// 이걸 하면 알파맵이 수정됌
mosaic.start({ x, y });
mosaic.move({ x, y });
mosaic.move({ x, y });
mosaic.makeHistory();
mosaic.render(); // 이걸 하면 resultTexture의 dirtyRect 영역이 모자이크로 수정됌

mosaic.start({ x, y });
mosaic.move({ x, y });
mosaic.cancel();

mosaic.undo(); // 이걸 하면 알파맵이 수정됌
mosaic.render(); // 이걸 하면 resultTexture가 수정됌

mosaic.redo(); // 이걸 하면 알파맵이 수정됌
mosaic.render(); // 이걸 하면 resultTexture 수정됌

mosaic.setMode("가우시안"); // 이걸 하면 모자이크 모드가 바뀌고, 기존 알파맵 영역이 다시 렌더링 대상이 됌
mosaic.render();
mosaic.setMode("픽셀"); // 이걸 하면 모자이크 모드가 바뀌고, 기존 알파맵 영역이 다시 렌더링 대상이 됌
mosaic.render();
mosaic.makeHistory();

// 대충 resultTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, resultTexture);

  // resultTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

render();
