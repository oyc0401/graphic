const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

// 원본이미지가 담긴 텍스쳐
const texture = gl.createTexture()!;

// 해당 텍스쳐는 정확히 그대로 화면 어딘가에 보여집니다.
const renderTexture = gl.createTexture()!;

// 변위맵은 외부에서 소유하고, liquify 모듈은 이 텍스쳐를 수정만 합니다.
const sourceDisplacementTexture = gl.createTexture()!;
const displacementTexture = gl.createTexture()!;

const liquify = createLiquify(gl, {
  imageTexture: texture,
  resultTexture: renderTexture,
  sourceDisplacementTexture,
  displacementTexture,
  width,
  height,
});

liquify.setRadius(50);
liquify.setStrength(0.5);

// 이걸 하면 변위맵이 수정됌
liquify.start({ x, y });
liquify.move({ x, y });
liquify.move({ x, y });

// makeHistory() 대신 end()가 변경된 rect를 리턴한다.
// 변경이 발생한 뒤에만 호출한다는 걸 보장하면 non-nullable.
// 히스토리 생성은 모듈 밖에서 담당한다.
const rect = liquify.end(); // LiquifyRect

liquify.start({ x, y });
liquify.move({ x, y });
liquify.cancel(); // 취소하면 변위맵이 이전 상태로 복원됌

// 이걸 하면 변위맵이 수정됌
liquify.spin({ x, y });
liquify.spin({ x, y });
liquify.spin({ x, y });
let rect1 = liquify.end();

// 이걸 하면 변위맵이 수정됌
liquify.rightSpin({ x, y });
let rect2 = liquify.end();

// 이걸 하면 변위맵이 수정됌
liquify.bloat({ x, y });
liquify.bloat({ x, y });
let rect3 = liquify.end();

// 이걸 하면 변위맵이 수정됌
liquify.pucker({ x, y });
liquify.pucker({ x, y });
let rect4 = liquify.end();

// 이걸 하면 변위맵이 원본 상태로 복원됌
liquify.restoreStart({ x, y });
liquify.restoreMove({ x, y });
liquify.restoreMove({ x, y });
let rect5 = liquify.end();

liquify.render(); // 이걸 하면 resultTexture 수정됌

// undo/redo는 liquify 내부에 없다.
// end()가 리턴한 rect와 외부 소유 texture로 모듈 밖에서 히스토리를 관리한다.

// 대중 resultTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, renderTexture);

  // renderTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

render();
