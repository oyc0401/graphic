import { BrushTool } from "./BrushTool";
import { SelectTool } from "./SelectionTool";

export const toolRegistry = {
  brush: new BrushTool(),

  select: new SelectTool(),
};
