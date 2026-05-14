import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";
import { ToolId } from "../paintState";

interface ToolMetadata {
  allowCanvasResizeHandle: boolean;
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
    allowCanvasResizeHandle: true,
  },
  [ToolId.Session]: {
    allowCanvasResizeHandle: false,
  },
  [ToolId.Select]: {
    allowCanvasResizeHandle: false,
    cursorClass: "select",
  },
  [ToolId.Selection]: {
    allowCanvasResizeHandle: false,
  },
  [ToolId.Zoom]: {
    allowCanvasResizeHandle: false,
    cursorClass: "zoom",
  },
  [ToolId.ColorPicker]: {
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
