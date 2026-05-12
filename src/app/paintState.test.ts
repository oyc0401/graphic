import { beforeEach, describe, expect, it } from "vitest";
import { paintState } from "./paintState";

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    paintState.setCoreTool("brush");
    paintState.setSelectedToolId("brush");
  });

  it("selects zoom as a persistent tool", () => {
    paintState.setSelectedToolId("zoom");

    expect(paintState.toolId).toBe("zoom");
    expect(paintState.activeToolId).toBe("zoom");
  });

  it("selects color picker as a persistent tool", () => {
    paintState.setSelectedToolId("colorPicker");

    expect(paintState.toolId).toBe("colorPicker");
    expect(paintState.activeToolId).toBe("colorPicker");
  });

  it("restores temporary color picker to the selected tool", () => {
    paintState.setSelectedToolId("brush");
    paintState.setInputMode("COLOR_PICKER");

    expect(paintState.activeToolId).toBe("colorPicker");

    paintState.restoreSelectedToolMode();

    expect(paintState.toolId).toBe("brush");
    expect(paintState.activeToolId).toBe("brush");
  });

  it("keeps liquify as a session tool instead of a brush id", () => {
    paintState.setCoreTool("liquify");

    expect(paintState.toolId).toBe("session");
    expect(paintState.activeToolId).toBe("session");
    expect(paintState.brushId).toBe("brush");
    expect(paintState.coreTool).toBe("liquify");
    expect(paintState.sessionToolId).toBe("liquify");
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.setCoreTool("liquify");
    paintState.setSessionToolId(null);

    expect(paintState.toolId).toBe("brush");
    expect(paintState.sessionToolId).toBeNull();
    expect(paintState.coreTool).toBe("brush");
  });

  it("supports mosaic as a future session tool", () => {
    paintState.setSessionToolId("mosaic");

    expect(paintState.toolId).toBe("session");
    expect(paintState.sessionToolId).toBe("mosaic");
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("derives core tool from the selected brush id", () => {
    paintState.setCoreTool("eraser");

    expect(paintState.toolId).toBe("brush");
    expect(paintState.brushId).toBe("eraser");
    expect(paintState.coreTool).toBe("eraser");
  });
});
