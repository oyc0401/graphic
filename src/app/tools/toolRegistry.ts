import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";
import { BrushId, ToolId } from "../paintState";

type ToolKind = "core" | "transient" | "viewport";

interface ToolMetadata {
  kind: ToolKind;
  allowCanvasResizeHandle: boolean;
  blockCanvasResizeHandleBrushIds?: BrushId[];
  cursorClass?: string;
}

export const toolRegistry = {
  [ToolId.Brush]: new BrushTool(),
  [ToolId.Session]: new BrushTool(),
  [ToolId.Selection]: new SelectionTool(),
  [ToolId.Select]: new SelectTool(),
  [ToolId.Zoom]: zoomTool,
  [ToolId.ColorPicker]: new ColorPickerTool(),
};

export const toolMetadata: Record<ToolId, ToolMetadata> = {
  [ToolId.Brush]: {
    kind: "core",
    allowCanvasResizeHandle: true,
  },
  [ToolId.Session]: {
    kind: "core",
    allowCanvasResizeHandle: false,
  },
  [ToolId.Select]: {
    kind: "core",
    allowCanvasResizeHandle: false,
    cursorClass: "select",
  },
  [ToolId.Selection]: {
    kind: "core",
    allowCanvasResizeHandle: false,
  },
  [ToolId.Zoom]: {
    kind: "viewport",
    allowCanvasResizeHandle: false,
    cursorClass: "zoom",
  },
  [ToolId.ColorPicker]: {
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
