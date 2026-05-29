import { createMosaicMask } from "./maskModule";
import type { MosaicPoint, MosaicRect } from "./maskModule";
import { createMosaicRender } from "./renderModule";

export type { MosaicPoint, MosaicRect } from "./maskModule";

function unionRect(a: MosaicRect | null, b: MosaicRect | null): MosaicRect | null {
  if (!a) return b;
  if (!b) return a;

  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export type MosaicMode = "pixel" | "blur" | "restore";
type MosaicEffectMode = Exclude<MosaicMode, "restore">;

export interface CreateMosaicOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  sourceMaskTexture: WebGLTexture;
  maskTexture: WebGLTexture;
  width: number;
  height: number;
}

export function createMosaic(
  gl: WebGL2RenderingContext,
  options: CreateMosaicOptions,
) {
  return new Mosaic(gl, options);
}

class Mosaic {
  private readonly mask: ReturnType<typeof createMosaicMask>;
  private readonly renderer: ReturnType<typeof createMosaicRender>;
  private mode: MosaicEffectMode = "pixel";
  private committedMode: MosaicEffectMode = "pixel";
  private isRestoring = false;
  private strength = 0.5;
  private committedStrength = 0.5;
  private dirtyRect: MosaicRect | null = null;
  private maskRect: MosaicRect | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    options: CreateMosaicOptions,
  ) {
    this.mask = createMosaicMask(gl, {
      sourceMaskTexture: options.sourceMaskTexture,
      maskTexture: options.maskTexture,
      width: options.width,
      height: options.height,
    });
    this.renderer = createMosaicRender(gl, {
      imageTexture: options.imageTexture,
      maskTexture: options.maskTexture,
      resultTexture: options.resultTexture,
      width: options.width,
      height: options.height,
    });
  }

  setRadius(radius: number) {
    this.mask.setRadius(radius);
  }

  setStrength(strength: number) {
    const nextStrength = Math.max(0, Math.min(1, strength));
    if (this.strength === nextStrength) return;

    this.strength = nextStrength;
    this.renderer.setStrength(nextStrength);
    this.markDirty(this.maskRect);
  }

  setMode(mode: MosaicMode) {
    if (mode === "restore") {
      this.isRestoring = true;
      return;
    }

    this.isRestoring = false;
    if (this.mode === mode) return;

    this.mode = mode;
    this.renderer.setMode(mode);
    this.markDirty(this.maskRect);
  }

  start(point: MosaicPoint): MosaicRect | null {
    const rect = this.isRestoring ? this.mask.restoreStart(point) : this.mask.start(point);
    this.maskRect = unionRect(this.maskRect, rect);
    return this.markDirty(rect);
  }

  move(point: MosaicPoint): MosaicRect | null {
    const rect = this.isRestoring ? this.mask.restoreMove(point) : this.mask.move(point);
    this.maskRect = unionRect(this.maskRect, rect);
    return this.markDirty(rect);
  }

  end(): MosaicRect | null {
    const strokeRect = this.mask.end();
    const modeChanged = this.mode !== this.committedMode;
    const strengthChanged = this.strength !== this.committedStrength;
    const rect = unionRect(this.dirtyRect, strokeRect);
    if (!rect && !modeChanged && !strengthChanged) {
      return null;
    }

    this.committedMode = this.mode;
    this.committedStrength = this.strength;
    this.dirtyRect = null;
    return rect ?? this.maskRect;
  }

  cancel() {
    this.mask.end();
    this.dirtyRect = null;
    if (this.mode !== this.committedMode) {
      this.mode = this.committedMode;
      this.renderer.setMode(this.committedMode);
    }
    if (this.strength !== this.committedStrength) {
      this.strength = this.committedStrength;
      this.renderer.setStrength(this.committedStrength);
    }
  }

  getStrength() {
    return this.strength;
  }

  getMode() {
    return this.mode;
  }

  render(): MosaicRect | null {
    const rect = this.renderer.render(this.dirtyRect);
    this.dirtyRect = null;
    return rect;
  }

  destroy() {
    this.mask.destroy();
    this.renderer.destroy();
  }

  private markDirty(rect: MosaicRect | null): MosaicRect | null {
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }
}
