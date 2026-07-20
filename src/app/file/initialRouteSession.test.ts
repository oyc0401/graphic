import { describe, expect, it } from "vitest";
import { SessionId } from "../paintState";
import {
  dashboardPath,
  drawingPath,
  getInitialRoute,
} from "./initialRouteSession";

describe("getInitialRoute", () => {
  it("parses dashboard routes", () => {
    expect(getInitialRoute("/ko/dashboard")).toEqual({
      page: "dashboard",
      session: null,
      drawingId: null,
    });
    expect(getInitialRoute("/dashboard")).toEqual({
      page: "dashboard",
      session: null,
      drawingId: null,
    });
  });

  it("parses drawing id routes", () => {
    expect(getInitialRoute("/ko/ds23vs")).toEqual({
      page: "paint",
      session: null,
      drawingId: "ds23vs",
    });
    expect(getInitialRoute("/a1b2c3")).toEqual({
      page: "paint",
      session: null,
      drawingId: "a1b2c3",
    });
  });

  it("parses legacy /paint/{id} routes", () => {
    expect(getInitialRoute("/ko/paint/ds23vs").drawingId).toBe("ds23vs");
    expect(getInitialRoute("/paint/a1b2c3").drawingId).toBe("a1b2c3");
  });

  it("rejects malformed drawing ids", () => {
    expect(getInitialRoute("/ko/short1x2").drawingId).toBeNull();
    expect(getInitialRoute("/ko/UPPER!").drawingId).toBeNull();
    expect(getInitialRoute("/ko/toolong1").drawingId).toBeNull();
  });

  it("reads the session from the ?tool query only", () => {
    expect(getInitialRoute("/ko/ds23vs", "?tool=liquify")).toEqual({
      page: "paint",
      session: SessionId.Liquify,
      drawingId: "ds23vs",
    });
    expect(getInitialRoute("/ko/ds23vs", "?tool=mosaic").session).toBe(
      SessionId.Mosaic,
    );
    expect(getInitialRoute("/ko/paint", "?tool=mosaic").session).toBe(
      SessionId.Mosaic,
    );
    expect(getInitialRoute("/ko/ds23vs", "?tool=unknown").session).toBeNull();
    expect(getInitialRoute("/ko/ds23vs").session).toBeNull();
  });

  it("does not treat path segments as sessions", () => {
    // 경로 기반 세션 진입은 없다 — /{locale}/liquify|mosaic는 서버 리다이렉트가 처리한다
    expect(getInitialRoute("/ko/liquify").session).toBeNull();
    expect(getInitialRoute("/ko/paint").session).toBeNull();
  });
});

describe("drawingPath / dashboardPath", () => {
  it("keeps the locale prefix from the current pathname", () => {
    expect(drawingPath("ds23vs", "/ko/paint")).toBe("/ko/ds23vs");
    expect(drawingPath("ds23vs", "/ko/a1b2c3")).toBe("/ko/ds23vs");
    expect(dashboardPath("/ja/a1b2c3")).toBe("/ja/dashboard");
  });

  it("omits the locale prefix when the pathname has none", () => {
    expect(drawingPath("ds23vs", "/paint")).toBe("/ds23vs");
    expect(dashboardPath("/paint")).toBe("/dashboard");
  });
});
