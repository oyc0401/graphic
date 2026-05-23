import { LiquifyManager } from "./LiquifyManager";
import type { LiquifyTool, Pointer } from "@/core/types";

interface liquifyManager {
  enter(): void;

  start: (pointer: Pointer) => void;
  push: (pointer: Pointer) => void;
  apply: (pointer: Pointer) => void;
  render: () => void;

  end(): void;

  cancel(): void;

  undo(): Promise<any>;
  redo(): Promise<any>;
  getHistoryCount(): { undoCount: number; redoCount: number };

  exit(): void;
  applySession(): void;
  discardSession(): void;
  setTool(toolId: LiquifyTool): void;

  setSize: () => void;
}

const liquifyManagerStore = new Map<any, liquifyManager>();

export async function installLiquifyManager(canvas, gl) {
  let liquifyManager = await makeLiquifyManager(canvas, gl);
  liquifyManagerStore.set(gl, liquifyManager);
}

export function getLiquifyManager(canvas, gl) {
  let liquifyManager = liquifyManagerStore.get(gl)!;
  if (!liquifyManager) {
    console.error("Not Installed LiquifyManager!");
  }

  return liquifyManager;
}

async function makeLiquifyManager(canvas, gl) {
  let liquifyManager = await LiquifyManager.create(canvas, gl);

  return liquifyManager;
}
