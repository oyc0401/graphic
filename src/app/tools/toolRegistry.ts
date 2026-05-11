import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";
import type { CoreTool } from "@/core/types";
import type { ToolId } from "../paintState";

type ToolKind = "core" | "transient" | "viewport";

interface ToolMetadata {
  kind: ToolKind;
  coreTool?: CoreTool;
  allowCanvasResizeHandle: boolean;
  cursorClass?: string;
}

export const toolRegistry = {
  brush: new BrushTool(),
  selection: new SelectionTool(),
  select: new SelectTool(),
  zoom: zoomTool,
  colorPicker: new ColorPickerTool(),
};

export const toolMetadata: Record<ToolId, ToolMetadata> = {
  brush: {
    kind: "core",
    coreTool: "brush",
    allowCanvasResizeHandle: true,
  },
  select: {
    kind: "core",
    coreTool: "select",
    allowCanvasResizeHandle: true,
    cursorClass: "select",
  },
  selection: {
    kind: "core",
    coreTool: "selection",
    allowCanvasResizeHandle: false,
  },
  zoom: {
    kind: "viewport",
    allowCanvasResizeHandle: false,
    cursorClass: "zoom",
  },
  colorPicker: {
    kind: "transient",
    allowCanvasResizeHandle: false,
    cursorClass: "colorPicker",
  },
};

export function getToolMetadata(toolId: ToolId): ToolMetadata {
  return toolMetadata[toolId];
}

export function getToolCursorClasses(): string[] {
  return Object.values(toolMetadata)
    .map((metadata) => metadata.cursorClass)
    .filter((cursorClass): cursorClass is string => Boolean(cursorClass));
}
