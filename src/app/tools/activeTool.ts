import {
  BrushId,
  InputMode,
  paintState,
  SessionId,
  TemporaryToolId,
  ToolId,
} from "../paintState";
import { BrushTool } from "./BrushTool";
import { ColorPickerTool } from "./ColorPickerTool";
import { FreeformSelectTool } from "./FreeformSelectTool";
import { LiquifySessionTool } from "./LiquifyTool";
import { MosaicSessionTool } from "./MosaicTool";
import { panTool } from "./PanTool";
import { resizeTool } from "./resizeTool";
import { SelectTool } from "./SelectTool";
import { selectionTool } from "./SelectionTool";
import type { Tool } from "./Tool";
import { zoomTool } from "./ZoomTool";

const brushTool = new BrushTool();
const colorPickerTool = new ColorPickerTool();
const liquifySessionTool = new LiquifySessionTool();
const mosaicSessionTool = new MosaicSessionTool();
const selectTool = new SelectTool();
const freeformSelectTool = new FreeformSelectTool();

export function getCurrentTool(): Tool | null {
  switch (paintState.getInputMode()) {
    case InputMode.Pan:
      return panTool;
    case InputMode.Zoom:
      return zoomTool;
    case InputMode.Pinch:
      return null;
  }

  switch (paintState.getSessionId()) {
    case SessionId.Liquify:
      return liquifySessionTool;
    case SessionId.Mosaic:
      return mosaicSessionTool;
  }

  switch (paintState.getTemporaryToolId()) {
    case TemporaryToolId.ColorPicker:
      return colorPickerTool;
    case TemporaryToolId.Resize:
      return resizeTool;
  }

  switch (paintState.getSelectedToolId()) {
    case ToolId.Brush:
      return brushTool;
    case ToolId.Select:
      return selectTool;
    case ToolId.FreeformSelect:
      return freeformSelectTool;
    case ToolId.Selection:
      return selectionTool;
    case ToolId.Zoom:
      return zoomTool;
    case ToolId.ColorPicker:
      return colorPickerTool;
  }
}
