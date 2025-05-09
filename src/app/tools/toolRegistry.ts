import { BrushTool } from "./BrushTool";
import { ResizeTool } from "./resizeTool";
import { SelectionTool } from "./SelectionTool";
import { SelectTool } from "./SelectTool";

export const toolRegistry = {
  brush: new BrushTool(),
  selection: new SelectionTool(),
  resize: new ResizeTool(),
  select: new SelectTool(),
};
