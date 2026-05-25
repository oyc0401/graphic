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
