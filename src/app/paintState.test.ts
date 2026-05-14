import { beforeEach, describe, expect, it } from "vitest";
import { BrushId, InputMode, paintState, SessionId, ToolId } from "./paintState";

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setBrushId(BrushId.Brush);
    paintState.setSessionMode(false);
    paintState.setSessionId(SessionId.Liquify);
    paintState.setSelectedToolId(ToolId.Brush);
  });

  it("selects zoom as a persistent tool without changing input mode", () => {
    paintState.setSelectedToolId(ToolId.Zoom);

    expect(paintState.getToolId()).toBe(ToolId.Zoom);
    expect(paintState.getSelectedToolId()).toBe(ToolId.Zoom);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
  });

  it("selects color picker as a persistent tool without changing input mode", () => {
    paintState.setSelectedToolId(ToolId.ColorPicker);

    expect(paintState.getToolId()).toBe(ToolId.ColorPicker);
    expect(paintState.getSelectedToolId()).toBe(ToolId.ColorPicker);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
  });

  it("keeps temporary color picker in input mode only", () => {
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setInputMode(InputMode.ColorPicker);

    expect(paintState.getSelectedToolId()).toBe(ToolId.Brush);
    expect(paintState.getInputMode()).toBe(InputMode.ColorPicker);

    paintState.setInputMode(InputMode.DEFAULT);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
  });

  it("keeps liquify in session state instead of selected tool id", () => {
    paintState.setSessionId(SessionId.Liquify);
    paintState.setSessionMode(true);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(true);
    expect(paintState.getBrushId()).toBe(BrushId.Brush);
    expect(paintState.getSessionId()).toBe(SessionId.Liquify);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.setSessionId(SessionId.Liquify);
    paintState.setSessionMode(true);
    paintState.setSessionMode(false);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(false);
    expect(paintState.getSessionId()).toBe(SessionId.Liquify);
  });

  it("supports mosaic as a future session tool", () => {
    paintState.setSessionId(SessionId.Mosaic);
    paintState.setSessionMode(true);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(true);
    expect(paintState.getSessionId()).toBe(SessionId.Mosaic);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("keeps brush id separate from selected tool id", () => {
    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getBrushId()).toBe(BrushId.Eraser);
  });
});
