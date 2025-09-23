import { getManager } from "../../../utils/cachedManager";
import { SelectionManager } from "./SelectionManager";

export function getSelectionManager(canvas, gl) {
  const manager = getManager(
    gl,
    "selection",
    () => new SelectionManager(canvas, gl),
  );
  return manager;
}
