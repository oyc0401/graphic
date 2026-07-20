import { SessionId } from "../paintState";

const TOOL_SESSION = {
  liquify: SessionId.Liquify,
  mosaic: SessionId.Mosaic,
} as const;

type ToolSessionName = keyof typeof TOOL_SESSION;

function isToolSessionName(value: string): value is ToolSessionName {
  return value === "liquify" || value === "mosaic";
}

function isLocaleSegment(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

export type InitialRoute = {
  page: "paint" | "dashboard";
  session: SessionId | null;
  drawingId: string | null;
};

const DRAWING_ID_PATTERN = /^[a-z0-9]{6}$/;

export function isDrawingIdSegment(segment: string): boolean {
  return DRAWING_ID_PATTERN.test(segment);
}

/** ?tool=liquify|mosaic — 세션 초기 셋팅은 이 쿼리로만 표현한다 */
export function getQuerySession(search: string): SessionId | null {
  const tool = new URLSearchParams(search).get("tool");
  return tool !== null && isToolSessionName(tool) ? TOOL_SESSION[tool] : null;
}

export function getInitialRoute(
  pathname = window.location.pathname,
  // 테스트(node 환경)에서 pathname만 넘겨도 동작하도록 window 접근을 지연한다
  search = typeof window === "undefined" ? "" : window.location.search,
): InitialRoute {
  const segments = pathname.split("/").filter(Boolean);
  const rest = isLocaleSegment(segments[0] ?? "") ? segments.slice(1) : segments;
  const querySession = getQuerySession(search);

  if (rest.length === 1 && rest[0] === "dashboard") {
    return { page: "dashboard", session: null, drawingId: null };
  }

  // /{locale}/{id} — 현재 주소 체계
  if (rest.length === 1 && isDrawingIdSegment(rest[0])) {
    return { page: "paint", session: querySession, drawingId: rest[0] };
  }

  // /{locale}/paint/{id} — 구 주소 체계. 부트 후 /{locale}/{id}로 normalize된다.
  if (
    rest.length === 2 &&
    rest[0] === "paint" &&
    DRAWING_ID_PATTERN.test(rest[1])
  ) {
    return { page: "paint", session: querySession, drawingId: rest[1] };
  }

  return { page: "paint", session: querySession, drawingId: null };
}

function localePrefix(pathname: string): string {
  const [first] = pathname.split("/").filter(Boolean);
  return isLocaleSegment(first ?? "") ? `/${first}` : "";
}

export function drawingPath(
  drawingId: string,
  pathname = window.location.pathname,
): string {
  return `${localePrefix(pathname)}/${drawingId}`;
}

export function dashboardPath(pathname = window.location.pathname): string {
  return `${localePrefix(pathname)}/dashboard`;
}

/** 새 그림 페이지 (id 없는 /paint — 진입 시 새 해시가 부여된다) */
export function paintPath(pathname = window.location.pathname): string {
  return `${localePrefix(pathname)}/paint`;
}

/** 랜딩 페이지 — /{locale}, 로케일이 없으면 루트 */
export function landingPath(pathname = window.location.pathname): string {
  return localePrefix(pathname) || "/";
}
