// utils/selectionHitTest.ts
import { getCamera, getPixelRatio, position } from "../position";
import { sceneLengthToCss, sceneToContainer } from "./cameraMath";

export type HandleType =
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

/**
 * 선택창·핸들 히트테스트
 * @param clientX  화면 기준 X
 * @param clientY  화면 기준 Y
 * @param selRect  { x, y, width, height }  // canvas 공간 기준
 * @param margin   핸들 margin (22px)
 */
export function getSelectionHandleAtPoint(
  clientX: number,
  clientY: number,
  selRect: { x: number; y: number; width: number; height: number },
  margin = 22,
): HandleType {
  const cam = getCamera();
  const dpr = getPixelRatio();

  /** ───── ① canvas 좌표 → 화면 좌표 변환 */
  // X는 컨테이너 로컬 그대로, Y만 컨테이너 상단(AppBar) 오프셋 보정 — 기존 동작 유지
  const toScreen = (canvasX: number, canvasY: number) => {
    const p = sceneToContainer(canvasX, canvasY, cam, dpr);
    return {
      x: p.x,
      y: p.y + position.bouncingRect.y - position.bottomNavHeight,
    };
  };

  const { x: cX, y: cY, width: cW, height: cH } = selRect;
  const p = toScreen(cX, cY);
  const w = sceneLengthToCss(cW, cam.scale, dpr);
  const h = sceneLengthToCss(cH, cam.scale, dpr);

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

  // ───── 꼭짓점 44×44
  const corners = {
    LT: { x: left - m, y: top - m, w: m * 2, h: m * 2 },
    RT: { x: right - m, y: top - m, w: m * 2, h: m * 2 },
    RB: { x: right - m, y: bottom - m, w: m * 2, h: m * 2 },
    LB: { x: left - m, y: bottom - m, w: m * 2, h: m * 2 },
  } as const;

  // ───── 모서리 (두께 44, 길이는 선택창 길이)
  const edges = {
    T: { x: left, y: top - m, w: w, h: m * 2 },
    R: { x: right - m, y: top, w: m * 2, h: h },
    B: { x: left, y: bottom - m, w: w, h: m * 2 },
    L: { x: left - m, y: top, w: m * 2, h: h },
  } as const;

  // ───── 우선순위: 꼭짓점 → 모서리 → 내부
  for (const k of ["RB", "RT", "LB", "LT"] as const)
    if (
      inRect(clientX, clientY, {
        ...corners[k],
        w: corners[k].w,
        h: corners[k].h,
      })
    )
      return k;

  for (const k of ["B", "R", "L", "T"] as const)
    if (inRect(clientX, clientY, { ...edges[k], w: edges[k].w, h: edges[k].h }))
      return k;

  if (
    inRect(clientX, clientY, {
      x: left + m,
      y: top + m,
      w: w - m * 2,
      h: h - m * 2,
    })
  )
    return "INSIDE";

  return "OUTSIDE";
}
