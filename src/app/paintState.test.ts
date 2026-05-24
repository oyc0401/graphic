import { beforeEach, describe, expect, it } from "vitest";
import {
  BrushId,
  InputMode,
  LiquifyToolId,
  paintState,
  SessionId,
  TemporaryToolId,
  ToolId,
} from "./paintState";

const liquifyToolIds = [
  LiquifyToolId.Push,
  LiquifyToolId.TwirlClockwise,
  LiquifyToolId.TwirlCounterClockwise,
  LiquifyToolId.Bloat,
  LiquifyToolId.Pucker,
  LiquifyToolId.Restore,
];

function resetBrushSettings() {
  paintState.setSessionId(null);

  paintState.setBrushId(BrushId.Brush);
  paintState.setBrushSize(5);
  paintState.setBrushAlpha(100);

  paintState.setBrushId(BrushId.Eraser);
  paintState.setBrushSize(10);
  paintState.setBrushAlpha(100);

  paintState.setSessionId(SessionId.Liquify);
  for (const toolId of liquifyToolIds) {
    paintState.setLiquifyToolId(toolId);
    paintState.setBrushSize(50);
    paintState.setBrushAlpha(100);
  }

  paintState.setSessionId(SessionId.Mosaic);
  paintState.setBrushSize(50);
  paintState.setBrushAlpha(100);
}

describe("paintState tool mode mapping", () => {
  beforeEach(() => {
    resetBrushSettings();
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    paintState.setBrushId(BrushId.Brush);
    paintState.setSessionId(null);
    paintState.setLiquifyToolId(LiquifyToolId.Push);
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

  it("keeps temporary color picker separate from input mode", () => {
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setTemporaryToolId(TemporaryToolId.ColorPicker);

    expect(paintState.getSelectedToolId()).toBe(ToolId.Brush);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
    expect(paintState.getTemporaryToolId()).toBe(TemporaryToolId.ColorPicker);

    paintState.setTemporaryToolId(null);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getInputMode()).toBe(InputMode.DEFAULT);
  });

  it("keeps liquify in session state instead of selected tool id", () => {
    paintState.setSessionId(SessionId.Liquify);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(true);
    expect(paintState.getBrushId()).toBe(BrushId.Brush);
    expect(paintState.getSessionId()).toBe(SessionId.Liquify);
    expect(paintState.getBrushSize()).toBe(50);
  });

  it("clears session tool by returning to brush", () => {
    paintState.setSessionId(SessionId.Liquify);
    paintState.setSessionId(null);

    expect(paintState.getToolId()).toBe(ToolId.Brush);
    expect(paintState.getSessionMode()).toBe(false);
    expect(paintState.getSessionId()).toBeNull();
  });

  it("supports mosaic as a future session tool", () => {
    paintState.setSessionId(SessionId.Mosaic);

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

  it("keeps brush settings separate between liquify tool groups", () => {
    paintState.setSessionId(SessionId.Liquify);

    paintState.setLiquifyToolId(LiquifyToolId.Push);
    paintState.setBrushSize(80);
    paintState.setBrushAlpha(25);

    paintState.setLiquifyToolId(LiquifyToolId.TwirlClockwise);
    paintState.setBrushSize(120);
    paintState.setBrushAlpha(60);

    paintState.setLiquifyToolId(LiquifyToolId.Push);
    expect(paintState.getBrushSize()).toBe(80);
    expect(paintState.getBrushAlpha()).toBe(25);

    paintState.setLiquifyToolId(LiquifyToolId.TwirlClockwise);
    expect(paintState.getBrushSize()).toBe(120);
    expect(paintState.getBrushAlpha()).toBe(60);

    paintState.setLiquifyToolId(LiquifyToolId.Restore);
    expect(paintState.getBrushSize()).toBe(50);
    expect(paintState.getBrushAlpha()).toBe(100);
  });

  it("shares brush settings between clockwise and counter-clockwise liquify twirl", () => {
    paintState.setSessionId(SessionId.Liquify);

    paintState.setLiquifyToolId(LiquifyToolId.TwirlClockwise);
    paintState.setBrushSize(140);
    paintState.setBrushAlpha(45);

    paintState.setLiquifyToolId(LiquifyToolId.TwirlCounterClockwise);
    expect(paintState.getBrushSize()).toBe(140);
    expect(paintState.getBrushAlpha()).toBe(45);
  });

  it("shares brush settings between liquify bloat and pucker", () => {
    paintState.setSessionId(SessionId.Liquify);

    paintState.setLiquifyToolId(LiquifyToolId.Bloat);
    paintState.setBrushSize(160);
    paintState.setBrushAlpha(35);

    paintState.setLiquifyToolId(LiquifyToolId.Pucker);
    expect(paintState.getBrushSize()).toBe(160);
    expect(paintState.getBrushAlpha()).toBe(35);
  });
});
