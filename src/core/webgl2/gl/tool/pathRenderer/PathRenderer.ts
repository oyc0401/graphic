import { Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { TEXTURE_UNIT } from "../../texture";

export abstract class PathRenderer {
  protected gl: WebGL2RenderingContext;
  protected pathTex: WebGLTexture;
  protected points: Pointer[];

  constructor(gl: WebGL2RenderingContext, pathTex: WebGLTexture) {
    this.gl = gl;
    this.pathTex = pathTex;
  }

  abstract resetWorkSpace(width: number, height: number): void;

  /**
   * 스트로크 시작 - 포인터 배열 초기화 및 첫 포인트 추가
   * ⚠️ 자식 클래스에서 반드시 super.start()를 먼저 호출해야 함
   */
  start(pointer: Pointer): void {
    this.points = [];
    this.points.push(pointer);
  }

  /**
   * 스트로크 진행 중 - 새 포인트 추가
   * 자식 클래스에서 오버라이드하여 실제 렌더링 로직 구현
   */
  stroke(point: Pointer): Rect | null {
    this.points.push(point);
    return null;
  }

  /**
   * 스트로크 완료 - 포인터 배열 정리
   * ⚠️ 자식 클래스에서 반드시 super.end()를 마지막에 호출해야 함
   */
  end(): Rect | null {
    this.points = [];
    return null;
  }

  /**
   * 스트로크 취소 - 포인터 배열 정리
   */
  cancel(): void {
    this.points = [];
  }

  abstract getStrokeDirtyRect(): Rect;

  protected clearPathTex(width: number, heigth: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathTex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      width,
      heigth,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      null
    );
  }
}
