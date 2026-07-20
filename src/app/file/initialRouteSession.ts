import { SessionId } from "../paintState";

const ROUTE_SESSION_BY_SEGMENT = {
  liquify: SessionId.Liquify,
  mosaic: SessionId.Mosaic,
} as const;

type RouteSessionSegment = keyof typeof ROUTE_SESSION_BY_SEGMENT;

function isLocaleSegment(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment);
}

function isRouteSessionSegment(segment: string): segment is RouteSessionSegment {
  return segment === "liquify" || segment === "mosaic";
}

export function getInitialRouteSession(
  pathname = window.location.pathname,
): SessionId | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (segments.length === 1) {
    const [tool] = segments;
    return isRouteSessionSegment(tool) ? ROUTE_SESSION_BY_SEGMENT[tool] : null;
  }

  if (segments.length === 2) {
    const [locale, tool] = segments;
    if (!isLocaleSegment(locale) || !isRouteSessionSegment(tool)) return null;
    return ROUTE_SESSION_BY_SEGMENT[tool];
  }

  return null;
}

export type InitialRoute = {
  page: "paint" | "dashboard";
  session: SessionId | null;
  drawingId: string | null;
};

const DRAWING_ID_PATTERN = /^[a-z0-9]{6}$/;

export function getInitialRoute(
  pathname = window.location.pathname,
): InitialRoute {
  const segments = pathname.split("/").filter(Boolean);
  const rest = isLocaleSegment(segments[0] ?? "") ? segments.slice(1) : segments;

  if (rest.length === 1 && rest[0] === "dashboard") {
    return { page: "dashboard", session: null, drawingId: null };
  }

  if (
    rest.length === 2 &&
    rest[0] === "paint" &&
    DRAWING_ID_PATTERN.test(rest[1])
  ) {
    return { page: "paint", session: null, drawingId: rest[1] };
  }

  return {
    page: "paint",
    session: getInitialRouteSession(pathname),
    drawingId: null,
  };
}

function localePrefix(pathname: string): string {
  const [first] = pathname.split("/").filter(Boolean);
  return isLocaleSegment(first ?? "") ? `/${first}` : "";
}

export function drawingPath(
  drawingId: string,
  pathname = window.location.pathname,
): string {
  return `${localePrefix(pathname)}/paint/${drawingId}`;
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
