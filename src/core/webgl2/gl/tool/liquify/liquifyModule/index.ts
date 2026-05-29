import { createLiquifyDisplacement } from "./displacementModule";
import { createLiquifyRender } from "./renderModule";
import { unionRect } from "./rect";
import type { LiquifyPoint, LiquifyRect } from "./rect";

export type { LiquifyPoint, LiquifyRect } from "./rect";

export interface CreateLiquifyOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  sourceDisplacementTexture: WebGLTexture;
  displacementTexture: WebGLTexture;
  width: number;
  height: number;
}

export function createLiquify(
  gl: WebGL2RenderingContext,
  options: CreateLiquifyOptions,
) {
  return new Liquify(gl, options);
}

class Liquify {
  private readonly displacement: ReturnType<typeof createLiquifyDisplacement>;
  private readonly renderer: ReturnType<typeof createLiquifyRender>;
  private dirtyRect: LiquifyRect | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    options: CreateLiquifyOptions,
  ) {
    this.displacement = createLiquifyDisplacement(gl, {
      sourceDisplacementTexture: options.sourceDisplacementTexture,
      displacementTexture: options.displacementTexture,
      width: options.width,
      height: options.height,
    });
    this.renderer = createLiquifyRender(gl, {
      imageTexture: options.imageTexture,
      displacementTexture: options.displacementTexture,
      resultTexture: options.resultTexture,
      width: options.width,
      height: options.height,
    });
  }

  setRadius(radius: number) {
    this.displacement.setRadius(radius);
  }

  setStrength(strength: number) {
    this.displacement.setStrength(strength);
  }

  start(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.start(point));
  }

  move(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.move(point));
  }

  restoreStart(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.restoreStart(point));
  }

  restoreMove(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.restoreMove(point));
  }

  spin(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.spin(point));
  }

  rightSpin(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.rightSpin(point));
  }

  bloat(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.bloat(point));
  }

  pucker(point: LiquifyPoint): LiquifyRect | null {
    return this.markDirty(this.displacement.pucker(point));
  }

  end(): LiquifyRect | null {
    const rect = unionRect(this.dirtyRect, this.displacement.end());
    this.dirtyRect = null;
    return rect;
  }

  cancel() {
    this.markDirty(this.displacement.cancel());
  }

  render(): LiquifyRect | null {
    const rect = this.renderer.render(this.dirtyRect);
    this.dirtyRect = null;
    return rect;
  }

  destroy() {
    this.displacement.destroy();
    this.renderer.destroy();
  }

  private markDirty(rect: LiquifyRect | null): LiquifyRect | null {
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }
}
