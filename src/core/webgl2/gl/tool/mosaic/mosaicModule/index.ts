import { createMosaicMask } from "./maskModule";
import { createMosaicRender } from "./renderModule";
import { unionRect } from "./rect";
import type { MosaicPoint, MosaicRect } from "./rect";

export type { MosaicPoint, MosaicRect } from "./rect";

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
  private strength = 0.5;
  private committedStrength = 0.5;
  private dirtyRect: MosaicRect | null = null;

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
    if (this.mask.getMaskRect()) {
      this.markDirty(this.mask.getMaskRect());
    }
  }

  setMode(mode: MosaicMode) {
    if (mode === "restore") {
      this.mask.setRestoring(true);
      return;
    }

    this.mask.setRestoring(false);
    if (this.mode === mode) return;

    this.mode = mode;
    this.renderer.setMode(mode);
    this.markDirty(this.mask.getMaskRect());
  }

  start(point: MosaicPoint): MosaicRect | null {
    return this.markDirty(this.mask.start(point));
  }

  move(point: MosaicPoint): MosaicRect | null {
    return this.markDirty(this.mask.move(point));
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
    return rect ?? this.mask.getMaskRect();
  }

  cancel() {
    const rect = this.mask.cancel();
    this.markDirty(rect);
    if (this.mode !== this.committedMode) {
      this.mode = this.committedMode;
      this.renderer.setMode(this.committedMode);
      this.markDirty(this.mask.getMaskRect());
    }
    if (this.strength !== this.committedStrength) {
      this.strength = this.committedStrength;
      this.renderer.setStrength(this.committedStrength);
      this.markDirty(this.mask.getMaskRect());
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
