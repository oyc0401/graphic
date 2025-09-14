import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../../texture";
import { getLayerManager } from "../../layer";
import { getBufferManager, getFullQuadShader } from "../../vertexShader";

import { createShader, createProgram, getGlHelper } from "../../utils/glHelper";
import { getRenderingManager } from "../../render/render";
import {
  getHistoryManager,
  HistoryObject,
  Snapshot,
} from "../../history/history";

import { PixelReader } from "../../history/PixelReader";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";

import colorFrag from "./color.frag?raw";
import { DisplacementModifier } from "./DisplacementModifier";
import { LiquifyManager } from "./LiquifyManager";

interface liquifyManager {
  enter(): void;

  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  render: () => void;

  end(): void;

  cancel(): void;

  exit(): void;

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
