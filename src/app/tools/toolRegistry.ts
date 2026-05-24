import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { SessionTool } from "./SessionTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";
import { ToolId } from "../paintState";
import type { Tool } from "./Tool";

export const toolRegistry: Record<ToolId, Tool> = {
  [ToolId.Brush]: new BrushTool(),
  [ToolId.Session]: new SessionTool(),
  [ToolId.Selection]: new SelectionTool(),
  [ToolId.Select]: new SelectTool(),
  [ToolId.Zoom]: zoomTool,
  [ToolId.ColorPicker]: new ColorPickerTool(),
};
