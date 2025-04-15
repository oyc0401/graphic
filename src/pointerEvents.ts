import { paintState } from "./main";
import { toolRegistry } from "./tools";

type Phase = "down" | "move" | "up";

function dispatch(e: PointerEvent, phase: Phase) {
  const tool = toolRegistry[paintState.action];
  tool?.[phase]?.(e);
}

export function attachPointerEvents(root: HTMLElement) {
  root.addEventListener("pointerdown", (e) => dispatch(e, "down"), {
    passive: false,
  });
  window.addEventListener("pointermove", (e) => dispatch(e, "move"), {
    passive: false,
  });
  window.addEventListener("pointerup", (e) => dispatch(e, "up"), {
    passive: false,
  });
}
