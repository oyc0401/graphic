import { BrushTool } from "./BrushTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";

export const toolRegistry = {
  brush: new BrushTool(),
  selection: new SelectionTool(),
  select: new SelectTool(),
};
