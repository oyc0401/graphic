import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";
import { zoomTool } from "./ZoomTool";
import { ColorPickerTool } from "./ColorPickerTool";

export const toolRegistry = {
  brush: new BrushTool(),
  selection: new SelectionTool(),
  select: new SelectTool(),
  zoom: zoomTool,
  colorPicker: new ColorPickerTool(),
};
