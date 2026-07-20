import { describe, expect, it } from "vitest";
import { SessionId } from "../paintState";
import {
  dashboardPath,
  drawingPath,
  getInitialRoute,
  getInitialRouteSession,
} from "./initialRouteSession";

describe("getInitialRouteSession", () => {
  it("returns matching session for locale tool routes", () => {
    expect(getInitialRouteSession("/ko/liquify")).toBe(SessionId.Liquify);
    expect(getInitialRouteSession("/en/mosaic")).toBe(SessionId.Mosaic);
  });

  it("returns matching session for root tool aliases", () => {
    expect(getInitialRouteSession("/liquify")).toBe(SessionId.Liquify);
    expect(getInitialRouteSession("/mosaic")).toBe(SessionId.Mosaic);
  });

  it("ignores non-tool routes", () => {
    expect(getInitialRouteSession("/ko")).toBeNull();
    expect(getInitialRouteSession("/ko/brush")).toBeNull();
    expect(getInitialRouteSession("/foo/bar/mosaic")).toBeNull();
  });
});

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
    expect(getInitialRoute("/ko/paint/ds23vs")).toEqual({
      page: "paint",
      session: null,
      drawingId: "ds23vs",
    });
    expect(getInitialRoute("/paint/a1b2c3")).toEqual({
      page: "paint",
      session: null,
      drawingId: "a1b2c3",
    });
  });

  it("rejects malformed drawing ids", () => {
    expect(getInitialRoute("/ko/paint/short").drawingId).toBeNull();
    expect(getInitialRoute("/ko/paint/UPPER!").drawingId).toBeNull();
    expect(getInitialRoute("/ko/paint/toolong1").drawingId).toBeNull();
  });

  it("keeps session routes working", () => {
    expect(getInitialRoute("/ko/liquify")).toEqual({
      page: "paint",
      session: SessionId.Liquify,
      drawingId: null,
    });
    expect(getInitialRoute("/en/mosaic").session).toBe(SessionId.Mosaic);
    expect(getInitialRoute("/ko/paint")).toEqual({
      page: "paint",
      session: null,
      drawingId: null,
    });
  });
});

describe("drawingPath / dashboardPath", () => {
  it("keeps the locale prefix from the current pathname", () => {
    expect(drawingPath("ds23vs", "/ko/paint")).toBe("/ko/paint/ds23vs");
    expect(drawingPath("ds23vs", "/ko/liquify")).toBe("/ko/paint/ds23vs");
    expect(dashboardPath("/ja/paint/a1b2c3")).toBe("/ja/dashboard");
  });

  it("omits the locale prefix when the pathname has none", () => {
    expect(drawingPath("ds23vs", "/paint")).toBe("/paint/ds23vs");
    expect(dashboardPath("/paint")).toBe("/dashboard");
  });
});
