import { getCamera, getPixelRatio, position } from "../position";
import { sceneLengthToCss, sceneToContainer } from "./cameraMath";

export type ShapeHandleType =
  | "LT"
  | "T"
  | "RT"
  | "L"
  | "INSIDE"
  | "R"
  | "LB"
  | "B"
  | "RB"
  | "OUTSIDE";

export function getShapeHandleAtPoint(
  clientX: number,
  clientY: number,
  rect: { x: number; y: number; width: number; height: number },
  margin = 22,
): ShapeHandleType {
  const cam = getCamera();
  const dpr = getPixelRatio();

  // X는 컨테이너 로컬 그대로, Y만 컨테이너 상단(AppBar) 오프셋 보정 — 기존 동작 유지
  const toScreen = (canvasX: number, canvasY: number) => {
    const p = sceneToContainer(canvasX, canvasY, cam, dpr);
    return {
      x: p.x,
      y: p.y + position.bouncingRect.y - position.bottomNavHeight,
    };
  };

  const p = toScreen(rect.x, rect.y);
  const w = sceneLengthToCss(rect.width, cam.scale, dpr);
  const h = sceneLengthToCss(rect.height, cam.scale, dpr);

  const left = p.x;
  const right = p.x + w;
  const top = p.y;
  const bottom = p.y + h;
  const m = margin;

  const inRect = (
    x: number,
    y: number,
    r: { x: number; y: number; w: number; h: number },
  ) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  const corners = {
    LT: { x: left - m, y: top - m, w: m * 2, h: m * 2 },
    RT: { x: right - m, y: top - m, w: m * 2, h: m * 2 },
    RB: { x: right - m, y: bottom - m, w: m * 2, h: m * 2 },
    LB: { x: left - m, y: bottom - m, w: m * 2, h: m * 2 },
  } as const;

  const edges = {
    T: { x: left, y: top - m, w, h: m * 2 },
    R: { x: right - m, y: top, w: m * 2, h },
    B: { x: left, y: bottom - m, w, h: m * 2 },
    L: { x: left - m, y: top, w: m * 2, h },
  } as const;

  for (const k of ["RB", "RT", "LB", "LT"] as const) {
    if (inRect(clientX, clientY, corners[k])) return k;
  }

  for (const k of ["B", "R", "L", "T"] as const) {
    if (inRect(clientX, clientY, edges[k])) return k;
  }

  if (
    inRect(clientX, clientY, {
      x: left + m,
      y: top + m,
      w: w - m * 2,
      h: h - m * 2,
    })
  ) {
    return "INSIDE";
  }

  return "OUTSIDE";
}
