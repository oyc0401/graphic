import { describe, expect, it } from "vitest";
import { SessionId } from "../paintState";
import { getInitialRouteSession } from "./initialRouteSession";

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
