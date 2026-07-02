// 뷰/카메라 좌표 변환·줌·클램프의 단일 원천.
// 순수 모듈: DOM/싱글톤/부수효과 없음 — 모든 입력은 인자로 받는다.
//
// 좌표 용어:
//   scene     = 캔버스 픽셀 공간 (Camera.x/y의 단위)
//   container = 컨테이너 로컬 CSS px (오버레이 배치용)
//   client    = 뷰포트 CSS px (PointerEvent.clientX/Y)

export type Camera = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { dpr: number; rect: Rect };
export type DocSize = { width: number; height: number };

export function clientToScene(
  clientX: number,
  clientY: number,
  cam: Camera,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: ((clientX - vp.rect.x) / cam.scale) * vp.dpr - cam.x,
    y: ((clientY - vp.rect.y) / cam.scale) * vp.dpr - cam.y,
  };
}

export function sceneToClient(
  sceneX: number,
  sceneY: number,
  cam: Camera,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: ((sceneX + cam.x) * cam.scale) / vp.dpr + vp.rect.x,
    y: ((sceneY + cam.y) * cam.scale) / vp.dpr + vp.rect.y,
  };
}

export function sceneToContainer(
  sceneX: number,
  sceneY: number,
  cam: Camera,
  dpr: number,
): { x: number; y: number } {
  return {
    x: ((sceneX + cam.x) * cam.scale) / dpr,
    y: ((sceneY + cam.y) * cam.scale) / dpr,
  };
}

export function sceneLengthToCss(length: number, scale: number, dpr: number): number {
  return (length * scale) / dpr;
}

// CSS px 델타(휠/드래그 이동량) → scene 델타. sceneLengthToCss의 역변환.
export function cssDeltaToScene(delta: number, scale: number, dpr: number): number {
  return (delta / scale) * dpr;
}

export function sceneRectToContainer(rect: Rect, cam: Camera, dpr: number): Rect {
  const p = sceneToContainer(rect.x, rect.y, cam, dpr);
  return {
    x: p.x,
    y: p.y,
    width: sceneLengthToCss(rect.width, cam.scale, dpr),
    height: sceneLengthToCss(rect.height, cam.scale, dpr),
  };
}

// 앵커(scene 좌표)가 화면상 같은 자리에 머물도록 스케일 변경.
//   (anchor + oldPos) * oldScale == (anchor + newPos) * newScale
export function zoomAround(
  cam: Camera,
  anchorScene: { x: number; y: number },
  nextScale: number,
): Camera {
  return {
    scale: nextScale,
    x: ((anchorScene.x + cam.x) * cam.scale) / nextScale - anchorScene.x,
    y: ((anchorScene.y + cam.y) * cam.scale) / nextScale - anchorScene.y,
  };
}

// 카메라 오프셋을 문서가 화면에서 완전히 사라지지 않는 범위로 클램프.
export function clampOffset(cam: Camera, doc: DocSize, vp: Viewport): Camera {
  const screenWidth = vp.rect.width * vp.dpr;
  const screenHeight = vp.rect.height * vp.dpr;
  return {
    scale: cam.scale,
    x: Math.min(screenWidth / cam.scale, Math.max(-doc.width, cam.x)),
    y: Math.min(screenHeight / cam.scale, Math.max(-doc.height, cam.y)),
  };
}

// 화면의 percent 비율 안에 ratio(기본 √2) 종횡비 문서를 중앙 배치.
export function fitDocument(
  vp: Viewport,
  percent = 7 / 8,
  ratio = Math.SQRT2,
): { doc: DocSize; camera: Camera } {
  const W = vp.rect.width * vp.dpr;
  const H = vp.rect.height * vp.dpr;
  let width: number;
  let height: number;

  if (W >= H) {
    height = H * percent;
    width = height * ratio;
    if (width > W) {
      width = W * percent;
      height = width / ratio;
    }
  } else {
    width = W * percent;
    height = width * ratio;
    if (height > H) {
      height = H * percent;
      width = height / ratio;
    }
  }

  return {
    doc: { width: Math.floor(width), height: Math.floor(height) },
    camera: {
      x: Math.floor((W - width) / 2),
      y: Math.floor((H - height) / 2),
      scale: 1,
    },
  };
}
