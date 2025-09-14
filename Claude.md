twgl을 쓸 때 import \* as twgl from "twgl.js"; 로 임포트 할것

gl.uniform1i(
gl.getUniformLocation(selectionProgramInfo.program, "u_selection"),
TEXTURE_UNIT.RENDERED_SELECTION,
);
과 같이 유니폼 설정하는건 twgl으로 절대 절대 바꾸지 말 것.

twgl으로 프로그램 만들기 표준:
const vertexManager = getVertexManager(gl);

const renderProgramInfo = twgl.createProgramInfo(gl, [
vertexManager.vsSource,
renderFrag,
]);

twgl.setBuffersAndAttributes(
gl,
renderProgramInfo,
vertexManager.quadBufferInfo,
);

참고:
bufferManager.createFullQuadVAO(brushProgramInfo.program); 를
twgl.setBuffersAndAttributes(
gl,
brushProgramInfo,
vertexManager.quadBufferInfo,
);
이걸로 변경하기

텍스쳐 만들때

let pathTex = twgl.createTexture(gl, {
wrap: gl.CLAMP_TO_EDGE,
minMag: gl.LINEAR,
auto: false,
});

이렇게 auto는 꼭 false로 하기.
