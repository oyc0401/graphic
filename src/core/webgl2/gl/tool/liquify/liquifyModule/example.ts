const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

// 원본이미지가 담긴 텍스쳐
const texture = gl.createTexture()!;

// 해당 텍스쳐는 정확히 그대로 화면 어딘가에 보여집니다.
const renderTexture = gl.createTexture()!;

const liquify = createLiquify(gl, {
  imageTexture: texture,
  resultTexture: renderTexture,
  width,
  height,
});

liquify.setRadius(50);
liquify.setStrength(0.5);

// 이걸 하면 변위맵이 수정됌
liquify.start({ x, y });
liquify.move({ x, y });
liquify.move({ x, y });
liquify.makeHistory();

liquify.start({ x, y });
liquify.move({ x, y });
liquify.cancel();

// 이걸 하면 변위맵이 수정됌
liquify.spin({ x, y });
liquify.spin({ x, y });
liquify.spin({ x, y });
liquify.makeHistory();

// 이걸 하면 변위맵이 수정됌
liquify.rightSpin({ x, y });
liquify.makeHistory();

// 이걸 하면 변위맵이 수정됌
liquify.bloat({ x, y });
liquify.bloat({ x, y });
liquify.makeHistory();

// 이걸 하면 변위맵이 수정됌
liquify.pucker({ x, y });
liquify.pucker({ x, y });
liquify.makeHistory();

// 이걸 하면 변위맵이 원본 상태로 복원됌
liquify.restoreStart({ x, y });
liquify.restoreMove({ x, y });
liquify.restoreMove({ x, y });
liquify.makeHistory();

liquify.render(); // 이걸 하면 renderTexture가 수정됌

liquify.undo(); // 이걸 하면 변위맵이 수정됌
liquify.render(); // 이걸 하면 renderTexture가 수정됌

liquify.redo(); // 이걸 하면 변위맵이 수정됌
liquify.render(); // 이걸 하면 renderTexture가 수정됌

// 대중 renderTexture를 화면 어딘가에 렌더링한다는 함수
function render() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, renderTexture);

  // renderTexture를 읽는 셰이더와 fullscreen quad는 있다고 치자.
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

render();
