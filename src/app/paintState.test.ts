import { beforeEach, describe, expect, it } from "vitest";
import { BrushId, InputMode, paintState, SessionToolId, ToolId } from "./paintState";

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    paintState.setCoreTool("brush");
    paintState.setSelectedToolId(ToolId.Brush);
  });

  it("selects zoom as a persistent tool", () => {
    paintState.setSelectedToolId(ToolId.Zoom);

    expect(paintState.toolId).toBe(ToolId.Zoom);
    expect(paintState.activeToolId).toBe(ToolId.Zoom);
  });

  it("selects color picker as a persistent tool", () => {
    paintState.setSelectedToolId(ToolId.ColorPicker);

    expect(paintState.toolId).toBe(ToolId.ColorPicker);
    expect(paintState.activeToolId).toBe(ToolId.ColorPicker);
  });

  it("restores temporary color picker to the selected tool", () => {
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setInputMode(InputMode.ColorPicker);

    expect(paintState.activeToolId).toBe(ToolId.ColorPicker);

    paintState.restoreSelectedToolMode();

    expect(paintState.toolId).toBe(ToolId.Brush);
    expect(paintState.activeToolId).toBe(ToolId.Brush);
  });

  it("keeps liquify as a session tool instead of a brush id", () => {
    paintState.setCoreTool("liquify");

    expect(paintState.toolId).toBe(ToolId.Session);
    expect(paintState.activeToolId).toBe(ToolId.Session);
    expect(paintState.brushId).toBe(BrushId.Brush);
    expect(paintState.coreTool).toBe("liquify");
    expect(paintState.sessionToolId).toBe(SessionToolId.Liquify);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.setCoreTool("liquify");
    paintState.setSessionToolId(null);

    expect(paintState.toolId).toBe(ToolId.Brush);
    expect(paintState.sessionToolId).toBeNull();
    expect(paintState.coreTool).toBe("brush");
  });

  it("supports mosaic as a future session tool", () => {
    paintState.setSessionToolId(SessionToolId.Mosaic);

    expect(paintState.toolId).toBe(ToolId.Session);
    expect(paintState.sessionToolId).toBe(SessionToolId.Mosaic);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("derives core tool from the selected brush id", () => {
    paintState.setCoreTool("eraser");

    expect(paintState.toolId).toBe(ToolId.Brush);
    expect(paintState.brushId).toBe(BrushId.Eraser);
    expect(paintState.coreTool).toBe("eraser");
  });
});
