const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

// 원본 이미지가 담긴 텍스처
const imageTexture = gl.createTexture()!;

// 모자이크 결과가 기록되는 텍스처
const resultTexture = gl.createTexture()!;

// mask맵은 외부에서 소유하고, mosaic 모듈은 이 텍스쳐를 수정만 합니다.
const sourceMaskTexture = gl.createTexture()!;
const maskTexture = gl.createTexture()!;

const mosaic = createMosaic(gl, {
  imageTexture,
  resultTexture,
  sourceMaskTexture,
  maskTexture,
  width,
  height,
});

mosaic.setRadius(50);
mosaic.setStrength(0.5); // 이걸 하면, 모자이크 강도가 바뀌고, 기존 mask맵 영역이 다시 렌더링 대상이 됌
mosaic.render(); // 이걸 하면 resultTexture의 dirtyRect 영역이 모자이크로 수정됌

// 이걸 하면 mask맵 수정됌
mosaic.start({ x, y });
mosaic.move({ x, y });
mosaic.move({ x, y });
const rect1 = mosaic.end();
mosaic.render(); // 이걸 하면 resultTexture의 dirtyRect 영역이 모자이크로 수정됌

mosaic.start({ x, y });
mosaic.move({ x, y });
mosaic.cancel();

mosaic.setMode("blur"); // 이걸 하면 모자이크 모드가 바뀌고, 기존 mask맵 영역이 다시 렌더링 대상이 됌
mosaic.render();
mosaic.setMode("pixel"); // 이걸 하면 모자이크 모드가 바뀌고, 기존 mask맵 영역이 다시 렌더링 대상이 됌
mosaic.render();
const rect2 = mosaic.end();

// 이걸 하면 mask맵이 원본 상태로 복원됌
mosaic.restoreStart({ x, y });
mosaic.restoreMove({ x, y });
mosaic.restoreMove({ x, y });
const rect3 = mosaic.end();

mosaic.render(); // 이걸 하면 resultTexture 수정됌

// undo/redo는 mosaic 내부에 없다.
// end()가 리턴한 rect와 외부 소유 texture로 모듈 밖에서 히스토리를 관리한다.

// 대충 resultTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, resultTexture);

  // resultTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

render();
