import { beforeEach, describe, expect, it } from "vitest";
import { BrushId, InputMode, paintState, SessionToolId, ToolId } from "./paintState";

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    paintState.setBrushId(BrushId.Brush);
    paintState.setSessionToolId(null);
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
    paintState.setSessionToolId(SessionToolId.Liquify);

    expect(paintState.toolId).toBe(ToolId.Session);
    expect(paintState.activeToolId).toBe(ToolId.Session);
    expect(paintState.brushId).toBe(BrushId.Brush);
    expect(paintState.sessionToolId).toBe(SessionToolId.Liquify);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.setSessionToolId(SessionToolId.Liquify);
    paintState.setSessionToolId(null);

    expect(paintState.toolId).toBe(ToolId.Brush);
    expect(paintState.sessionToolId).toBeNull();
  });

  it("supports mosaic as a future session tool", () => {
    paintState.setSessionToolId(SessionToolId.Mosaic);

    expect(paintState.toolId).toBe(ToolId.Session);
    expect(paintState.sessionToolId).toBe(SessionToolId.Mosaic);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("keeps brush id separate from selected tool id", () => {
    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);

    expect(paintState.toolId).toBe(ToolId.Brush);
    expect(paintState.brushId).toBe(BrushId.Eraser);
  });
});
