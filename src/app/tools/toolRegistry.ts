import { BrushTool } from "./BrushTool";
import { LiquifySessionTool } from "./LiquifyTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";
import { ToolId } from "../paintState";
import type { Tool } from "./Tool";

export const toolRegistry: Record<ToolId, Tool> = {
  [ToolId.Brush]: new BrushTool(),
  [ToolId.Session]: new LiquifySessionTool(),
  [ToolId.Selection]: new SelectionTool(),
  [ToolId.Select]: new SelectTool(),
  [ToolId.Zoom]: zoomTool,
  [ToolId.ColorPicker]: new ColorPickerTool(),
};
