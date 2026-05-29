import { createMosaicMask } from "./maskModule";
import { mosaicRenderModule } from "./renderModule";

const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;

const width = canvas.width;
const height = canvas.height;

// 원본이미지가 담긴 텍스쳐
const imageTexture = gl.createTexture()!;

// 결과 텍스쳐. 화면에 그대로 보여진다.
const resultTexture = gl.createTexture()!;

// sourceMaskTexture: 스트로크 시작 시점의 mask 스냅샷 (read-only 기준)
// maskTexture: 스트로크 중 실제로 수정되는 mask
// 두 모듈이 이 텍스쳐들을 공유한다.
const sourceMaskTexture = gl.createTexture()!;
const maskTexture = gl.createTexture()!;

const mask = createMosaicMask(gl, {
  sourceMaskTexture,
  maskTexture,
  width,
  height,
});

const render = mosaicRenderModule(gl, {
  imageTexture,
  resultTexture,
  maskTexture,
  width,
  height,
});

mask.setRadius(50);
render.setStrength(0.5);

// 페인트 스트로크: start -> move... -> end
// mask가 dirty rect를 반환 → 해당 영역만 render한다.
const previewRect1 = mask.start({ x: 100, y: 100 });
render.render(previewRect1); // mask맵을 보고 특정부분을 렌더링

const previewRect2 = mask.move({ x: 130, y: 110 });
render.render(previewRect2);

const strokeRect = mask.end(); // 이 스트로크 전체의 bounding rect 반환
// 외부에서 strokeRect 범위의 maskTexture를 sourceMaskTexture에 커밋하고 히스토리를 만든다.
// allStrokesRect에 strokeRect를 누적한다.

// cancel일 때
const previewRect3 = mask.start({ x: 200, y: 200 });
render.render(previewRect3);
const previewRect4 = mask.move({ x: 230, y: 210 });
render.render(previewRect4);

const strokeRect2 = mask.end();
// strokeRect2 범위의 maskTexture에 sourceMaskTexture로 덮어쓰고 render한다. 히스토리는 만들지 않음.
// allStrokesRect에는 추가하지 않는다.
render.render(strokeRect2);

// 모드 변경: blur (가우시안 블러)
render.setMode("blur");
render.render(allStrokesRect); // 지금까지 커밋된 모든 strokeRect의 합산

// 모드 변경: pixel (픽셀화)
render.setMode("pixel");
render.render(allStrokesRect);

// restore: mask를 지워서 원본으로 복원
const restoreRect1 = mask.restoreStart({ x: 100, y: 200 });
render.render(restoreRect1);
const restoreRect2 = mask.restoreMove({ x: 130, y: 210 });
render.render(restoreRect2);
const restoreStrokeRect = mask.end();
render.render(restoreStrokeRect);
