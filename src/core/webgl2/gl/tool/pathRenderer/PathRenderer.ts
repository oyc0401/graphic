import { Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";

export abstract class PathRenderer {
  protected gl: WebGL2RenderingContext;
  protected pathTex: WebGLTexture;

  constructor(gl: WebGL2RenderingContext, pathTex: WebGLTexture) {
    this.gl = gl;
    this.pathTex = pathTex;
  }

  abstract resetWorkSpace(width: number, height: number): void;
  abstract start(pointer: Pointer): void;
  abstract stroke(point: Pointer): Rect | null;
  abstract end(): Rect | null;
  abstract cancel(): void;
  abstract getStrokeDirtyRect(): Rect;
}
