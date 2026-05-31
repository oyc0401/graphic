import type { MosaicMode, Pointer } from "@/core/types";
import { MosaicManager } from "./MosaicManager";

interface mosaicManager {
  enter(): void;

  start(pointer: Pointer): void;
  push(pointer: Pointer): void;
  render(): void;

  end(): void;

  cancel(): void;

  undo(): Promise<any>;
  redo(): Promise<any>;
  getHistoryCount(): { undoCount: number; redoCount: number };

  exit(): void;
  applySession(): void;
  discardSession(): void;
  setMode(mode: MosaicMode): void;
  setStrength(strength: number): void;

}

const mosaicManagerStore = new Map<any, mosaicManager>();

export async function installMosaicManager(canvas, gl) {
  const mosaicManager = await makeMosaicManager(canvas, gl);
  mosaicManagerStore.set(gl, mosaicManager);
}

export function getMosaicManager(canvas, gl) {
  const mosaicManager = mosaicManagerStore.get(gl)!;
  if (!mosaicManager) {
    console.error("Not Installed MosaicManager!");
  }

  return mosaicManager;
}

async function makeMosaicManager(canvas, gl) {
  const mosaicManager = await MosaicManager.create(canvas, gl);

  return mosaicManager;
}
