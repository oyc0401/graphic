import { getPixelRatio, position } from "../position";

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
  const dpr = getPixelRatio();

  const toScreen = (canvasX: number, canvasY: number) => ({
    x: ((canvasX + position.x) * position.scale) / dpr,
    y:
      ((canvasY + position.y) * position.scale) / dpr +
      position.bouncingRect.y -
      position.bottomNavHeight,
  });

  const p = toScreen(rect.x, rect.y);
  const w = (rect.width * position.scale) / dpr;
  const h = (rect.height * position.scale) / dpr;

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
