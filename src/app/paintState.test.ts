import { beforeEach, describe, expect, it } from "vitest";
import { BrushId, InputMode, paintState, SessionId, ToolId } from "./paintState";

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setBrushId(BrushId.Brush);
    paintState.endSession();
    paintState.setSessionId(SessionId.Liquify);
    paintState.setSelectedToolId(ToolId.Brush);
  });

  it("selects zoom as a persistent tool without changing input mode", () => {
    paintState.setSelectedToolId(ToolId.Zoom);

    expect(paintState.getToolId()).toBe(ToolId.Zoom);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
    expect(paintState.getActiveToolId()).toBe(ToolId.Zoom);
  });

  it("selects color picker as a persistent tool without changing input mode", () => {
    paintState.setSelectedToolId(ToolId.ColorPicker);

    expect(paintState.getToolId()).toBe(ToolId.ColorPicker);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
    expect(paintState.getActiveToolId()).toBe(ToolId.ColorPicker);
  });

  it("restores temporary color picker with an explicit brush input mode", () => {
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setInputMode(InputMode.ColorPicker);

    expect(paintState.getActiveToolId()).toBe(ToolId.ColorPicker);

    paintState.setInputMode(InputMode.DEFAULT);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
    expect(paintState.getActiveToolId()).toBe(ToolId.Brush);
  });

  it("keeps liquify in session state instead of selected tool id", () => {
    paintState.startSession(SessionId.Liquify);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(true);
    expect(paintState.getActiveToolId()).toBe(ToolId.Session);
    expect(paintState.getBrushId()).toBe(BrushId.Brush);
    expect(paintState.getSessionId()).toBe(SessionId.Liquify);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.startSession(SessionId.Liquify);
    paintState.endSession();

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(false);
    expect(paintState.getSessionId()).toBe(SessionId.Liquify);
  });

  it("supports mosaic as a future session tool", () => {
    paintState.startSession(SessionId.Mosaic);

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
