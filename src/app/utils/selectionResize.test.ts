import { describe, expect, it } from "vitest";
import { resizeSelectionFromHandle } from "./selectionResize";

/**
 * selectionResize의 좌표계와 핸들별 리사이즈 정책을 문서화하는 테스트.
 *
 * 이 테스트는 SelectionTool, DOM PointerEvent, worker를 거치지 않고
 * resizeSelectionFromHandle 순수 함수만 검증한다. 선택창 리사이즈에서 가장 중요한 계약은
 * "포인터가 위치한 칸은 결과 선택창 안에 포함된다"는 inclusive 좌표 규칙이다.
 *
 * keepRatio=false는 포인터 칸까지 자유롭게 리사이즈하고,
 * keepRatio=true는 포인터 칸을 포함하면서 시작 선택창의 width/height 비율을 유지한다.
 *
 * describe 순서
 * keepRatio여부
 * ├── 정책
 * │   └── 핸들 종류
 * │       └── 상황
 * 순서: L, R, T, B, LT, RT, LB, RB
 *
 * 포맷 규칙
 * 기대값 객체는 줄바꿈하지 않고 한 줄로 적는다.
 */

describe("keepRatio=false일 때", () => {
  describe("포인터가 위치한 칸은 결과 선택창 안에 포함되어야 한다", () => {
    describe("L 핸들", () => {
      it("정지상태: 포인터가 기존 왼쪽 변에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 2, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 4, y: 2, width: 3, height: 5, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 왼쪽 변보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 0, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 0, y: 2, width: 7, height: 5, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 오른쪽 변까지 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 6, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 6, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });
    });

    describe("R 핸들", () => {
      it("정지상태: 포인터가 기존 오른쪽 변에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 6, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 3, height: 5, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 오른쪽 변보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 8, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 7, height: 5, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 왼쪽 변까지 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 2, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });
    });

    describe("T 핸들", () => {
      it("정지상태: 포인터가 기존 위쪽 변에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 4, width: 5, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 위쪽 변보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 0 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 0, width: 5, height: 7, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 아래쪽 변까지 이동하면 높이가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 6, width: 5, height: 1, flipH: false, flipV: false });
      });
    });

    describe("B 핸들", () => {
      it("정지상태: 포인터가 기존 아래쪽 변에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 아래쪽 변보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 9 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 8, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 위쪽 변까지 이동하면 높이가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 1, flipH: false, flipV: false });
      });
    });

    describe("LT 핸들", () => {
      it("정지상태: 포인터가 기존 왼쪽 위 끝 칸에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 2, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 4, y: 4, width: 3, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 왼쪽 위 끝보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 0, y: 0 },
            keepRatio: false,
          }),
        ).toEqual({ x: 0, y: 0, width: 7, height: 7, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 오른쪽 위 끝 칸으로 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 6, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 6, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });

      it("두 축 1칸: 포인터가 기존 오른쪽 아래 끝 칸으로 이동하면 너비와 높이가 모두 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 6, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 6, y: 6, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("RT 핸들", () => {
      it("정지상태: 포인터가 기존 오른쪽 위 끝 칸에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 6, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 4, width: 3, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 오른쪽 위 끝보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 8, y: 0 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 0, width: 7, height: 7, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 왼쪽 위 끝 칸으로 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 2, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });

      it("두 축 1칸: 포인터가 기존 왼쪽 아래 끝 칸으로 이동하면 너비와 높이가 모두 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 2, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 6, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("LB 핸들", () => {
      it("정지상태: 포인터가 기존 왼쪽 아래 끝 칸에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 2, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 4, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 4, y: 2, width: 3, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 왼쪽 아래 끝보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 0, y: 8 },
            keepRatio: false,
          }),
        ).toEqual({ x: 0, y: 2, width: 7, height: 7, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 오른쪽 아래 끝 칸으로 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 6, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 6, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });

      it("두 축 1칸: 포인터가 기존 오른쪽 위 끝 칸으로 이동하면 너비와 높이가 모두 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 6, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 6, y: 2, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("RB 핸들", () => {
      it("정지상태: 포인터가 기존 오른쪽 아래 끝 칸에 그대로 있으면 선택창의 위치와 크기는 변하지 않는다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 6, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 5, height: 5, flipH: false, flipV: false });
      });

      it("줄어들기: 포인터가 안쪽 칸으로 이동하면 그 칸까지 선택창이 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 5, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 4, height: 3, flipH: false, flipV: false });
      });

      it("늘어나기: 포인터가 기존 오른쪽 아래 끝보다 바깥 칸으로 이동하면 그 칸까지 선택창이 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 8, y: 9 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 7, height: 8, flipH: false, flipV: false });
      });

      it("한 축 1칸: 포인터가 기존 왼쪽 아래 끝 칸으로 이동하면 너비가 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 2, y: 6 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });

      it("두 축 1칸: 포인터가 기존 왼쪽 위 칸으로 이동하면 너비와 높이가 모두 1칸이 된다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 2, y: 2 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 2, width: 1, height: 1, flipH: false, flipV: false });
      });
    });
  });
  describe("도형을 뒤집으면 flip이 된다. (기본 상태)", () => {
    describe("L 핸들", () => {
      it("포인터가 기존 오른쪽 변을 지나가면 flipH가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 7, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 7, y: 2, width: 1, height: 5, flipH: true, flipV: false });
      });
    });

    describe("R 핸들", () => {
      it("포인터가 기존 왼쪽 변을 지나가면 flipH가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 1, y: 4 },
            keepRatio: false,
          }),
        ).toEqual({ x: 1, y: 2, width: 1, height: 5, flipH: true, flipV: false });
      });
    });

    describe("T 핸들", () => {
      it("포인터가 기존 아래쪽 변을 지나가면 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 7 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 7, width: 5, height: 1, flipH: false, flipV: true });
      });
    });

    describe("B 핸들", () => {
      it("포인터가 기존 위쪽 변을 지나가면 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 1 },
            keepRatio: false,
          }),
        ).toEqual({ x: 2, y: 1, width: 5, height: 1, flipH: false, flipV: true });
      });
    });

    describe("LT 핸들", () => {
      it("포인터가 기존 오른쪽 아래 끝을 지나가면 flipH와 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 7, y: 7 },
            keepRatio: false,
          }),
        ).toEqual({ x: 7, y: 7, width: 1, height: 1, flipH: true, flipV: true });
      });
    });

    describe("RT 핸들", () => {
      it("포인터가 기존 왼쪽 아래 끝을 지나가면 flipH와 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 1, y: 7 },
            keepRatio: false,
          }),
        ).toEqual({ x: 1, y: 7, width: 1, height: 1, flipH: true, flipV: true });
      });
    });

    describe("LB 핸들", () => {
      it("포인터가 기존 오른쪽 위 끝을 지나가면 flipH와 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 7, y: 1 },
            keepRatio: false,
          }),
        ).toEqual({ x: 7, y: 1, width: 1, height: 1, flipH: true, flipV: true });
      });
    });

    describe("RB 핸들", () => {
      it("포인터가 기존 왼쪽 위 끝을 지나가면 flipH와 flipV가 켜진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 1, y: 1 },
            keepRatio: false,
          }),
        ).toEqual({ x: 1, y: 1, width: 1, height: 1, flipH: true, flipV: true });
      });
    });
  });

  describe("도형을 뒤집으면 flip이 된다. (초기 flip 상태)", () => {
    describe("L 핸들", () => {
      it("flipH가 켜진 상태에서 포인터가 기존 오른쪽 변을 지나가면 flipH가 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "L",
            pointer: { x: 7, y: 4 },
            keepRatio: false,
            startFlipH: true,
          }),
        ).toEqual({ x: 7, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });
    });

    describe("R 핸들", () => {
      it("flipH가 켜진 상태에서 포인터가 기존 왼쪽 변을 지나가면 flipH가 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "R",
            pointer: { x: 1, y: 4 },
            keepRatio: false,
            startFlipH: true,
          }),
        ).toEqual({ x: 1, y: 2, width: 1, height: 5, flipH: false, flipV: false });
      });
    });

    describe("T 핸들", () => {
      it("flipV가 켜진 상태에서 포인터가 기존 아래쪽 변을 지나가면 flipV가 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "T",
            pointer: { x: 4, y: 7 },
            keepRatio: false,
            startFlipV: true,
          }),
        ).toEqual({ x: 2, y: 7, width: 5, height: 1, flipH: false, flipV: false });
      });
    });

    describe("B 핸들", () => {
      it("flipV가 켜진 상태에서 포인터가 기존 위쪽 변을 지나가면 flipV가 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "B",
            pointer: { x: 4, y: 1 },
            keepRatio: false,
            startFlipV: true,
          }),
        ).toEqual({ x: 2, y: 1, width: 5, height: 1, flipH: false, flipV: false });
      });
    });

    describe("LT 핸들", () => {
      it("flipH와 flipV가 켜진 상태에서 포인터가 기존 오른쪽 아래 끝을 지나가면 둘 다 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LT",
            pointer: { x: 7, y: 7 },
            keepRatio: false,
            startFlipH: true,
            startFlipV: true,
          }),
        ).toEqual({ x: 7, y: 7, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("RT 핸들", () => {
      it("flipH와 flipV가 켜진 상태에서 포인터가 기존 왼쪽 아래 끝을 지나가면 둘 다 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RT",
            pointer: { x: 1, y: 7 },
            keepRatio: false,
            startFlipH: true,
            startFlipV: true,
          }),
        ).toEqual({ x: 1, y: 7, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("LB 핸들", () => {
      it("flipH와 flipV가 켜진 상태에서 포인터가 기존 오른쪽 위 끝을 지나가면 둘 다 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "LB",
            pointer: { x: 7, y: 1 },
            keepRatio: false,
            startFlipH: true,
            startFlipV: true,
          }),
        ).toEqual({ x: 7, y: 1, width: 1, height: 1, flipH: false, flipV: false });
      });
    });

    describe("RB 핸들", () => {
      it("flipH와 flipV가 켜진 상태에서 포인터가 기존 왼쪽 위 끝을 지나가면 둘 다 꺼진다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 1, y: 1 },
            keepRatio: false,
            startFlipH: true,
            startFlipV: true,
          }),
        ).toEqual({ x: 1, y: 1, width: 1, height: 1, flipH: false, flipV: false });
      });
    });
  });
});

describe("keepRatio=true일 때", () => {
  describe("포인터가 위치한 칸을 포함하면서 시작 선택창의 비율을 유지해야 한다", () => {
    describe("L 핸들", () => {
      it("너비가 줄어들면 시작 비율에 맞게 높이도 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "L",
            pointer: { x: 5, y: 3 },
            keepRatio: true,
          }),
        ).toEqual({ x: 5, y: 2, width: 3, height: 2, flipH: false, flipV: false });
      });
    });

    describe("R 핸들", () => {
      it("너비가 늘어나면 시작 비율에 맞게 높이도 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "R",
            pointer: { x: 9, y: 3 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 2, width: 8, height: 4, flipH: false, flipV: false });
      });
    });

    describe("T 핸들", () => {
      it("높이가 늘어나면 시작 비율에 맞게 너비도 늘어난다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "T",
            pointer: { x: 4, y: 0 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 0, width: 10, height: 5, flipH: false, flipV: false });
      });
    });

    describe("B 핸들", () => {
      it("높이가 줄어들면 시작 비율에 맞게 너비도 줄어든다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "B",
            pointer: { x: 4, y: 3 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 2, width: 4, height: 2, flipH: false, flipV: false });
      });
    });

    describe("LT 핸들", () => {
      it("포인터가 만든 영역보다 세로가 부족하면 높이를 키워 비율을 유지한다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "LT",
            pointer: { x: 0, y: 1 },
            keepRatio: true,
          }),
        ).toEqual({ x: 0, y: 1, width: 8, height: 4, flipH: false, flipV: false });
      });
    });

    describe("RT 핸들", () => {
      it("포인터가 만든 영역보다 가로가 부족하면 너비를 키워 비율을 유지한다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "RT",
            pointer: { x: 7, y: 0 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 0, width: 10, height: 5, flipH: false, flipV: false });
      });
    });

    describe("LB 핸들", () => {
      it("포인터가 만든 영역보다 가로가 부족하면 너비를 키워 비율을 유지한다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "LB",
            pointer: { x: 1, y: 6 },
            keepRatio: true,
          }),
        ).toEqual({ x: -2, y: 2, width: 10, height: 5, flipH: false, flipV: false });
      });
    });

    describe("RB 핸들", () => {
      it("정사각형에서 포인터가 안쪽 칸으로 이동하면 포인터를 포함하면서 정사각형 비율을 유지한다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 5, height: 5 },
            handle: "RB",
            pointer: { x: 5, y: 4 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 2, width: 4, height: 4, flipH: false, flipV: false });
      });

      it("포인터가 만든 영역보다 세로가 부족하면 높이를 키워 비율을 유지한다", () => {
        expect(
          resizeSelectionFromHandle({
            startRect: { x: 2, y: 2, width: 6, height: 3 },
            handle: "RB",
            pointer: { x: 9, y: 3 },
            keepRatio: true,
          }),
        ).toEqual({ x: 2, y: 2, width: 8, height: 4, flipH: false, flipV: false });
      });
    });
  });
});
