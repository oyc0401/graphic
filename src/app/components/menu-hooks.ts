import React, {useEffect, useLayoutEffect} from "react";

export function useClickOutside(
  refs: React.RefObject<HTMLElement | null>[],
  handler: () => void,
) {
  useEffect(() => {
    const listener = (e: PointerEvent) => {
      if (refs.every((ref) => !ref.current?.contains(e.target as Node))) {
        handler();
      }
    };
    document.addEventListener("pointerdown", listener);
    return () => {
      document.removeEventListener("pointerdown", listener);
    };
  }, [refs, handler]);
}

export function useDropdownPosition(
  buttonRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  show: boolean,
  options?: {
    padding?: number;
    offsetX?: number;
    offsetY?: number;
    /** true → 기본 위치를 버튼 위로, false → 버튼 아래로 */
    invertY?: boolean;
  },
) {
  const padding  = options?.padding  ?? 8;
  const offsetX  = options?.offsetX  ?? 0;
  const offsetY  = options?.offsetY  ?? 0;
  const invertY  = options?.invertY ?? false;

  useLayoutEffect(() => {
    if (!show) return;

    const button = buttonRef.current;
    const menu   = menuRef.current;
    if (!button || !menu) return;

    const rect            = button.getBoundingClientRect();
    const menuWidth       = menu.offsetWidth;
    const menuHeight      = menu.offsetHeight;
    const viewportWidth   = window.innerWidth;
    const viewportHeight  = window.innerHeight;

    /* ─────────────── X 좌표 계산 ─────────────── */
    let left = rect.left + offsetX;

    // 오른쪽·왼쪽 경계 보정
    if (left + menuWidth + padding > viewportWidth) {
      left = viewportWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    /* ─────────────── Y 좌표 계산 ─────────────── */
    // invertY가 true면 기본 위치를 위쪽으로, false면 아래쪽으로
    const above = rect.top  - menuHeight - offsetY;
    const below = rect.bottom + offsetY;
    let top     = invertY ? above : below;

    // 화면 밖으로 튀면 반대쪽으로 fallback
    if (invertY) {
      if (top < padding) top = below;
    } else {
      if (top + menuHeight + padding > viewportHeight) top = above;
    }

    // 최종 경계 체크
    if (top < padding) top = padding;
    if (top + menuHeight + padding > viewportHeight) {
      top = viewportHeight - menuHeight - padding;
    }

    /* ─────────────── 스타일 적용 ─────────────── */
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;
  }, [buttonRef, menuRef, show, padding, offsetX, offsetY, invertY]);
}


type Direction = 'bottom' | 'top' | 'left' | 'right';

interface DropdownPositionOptions {
  /** 화면 끝과의 여유 (px) */
  padding?: number;
  /** X축 추가 이동 (px) */
  offsetX?: number;
  /** Y축 추가 이동 (px) */
  offsetY?: number;
  /** 기본 방향(bottom | top | left | right) */
  direction?: Direction;
}

export function useDropdownPosition2(
  buttonRef: React.RefObject<HTMLElement | null>,
  menuRef:   React.RefObject<HTMLElement | null>,
  show:      boolean,
  options:   DropdownPositionOptions = {},
) {
  const {
    padding   = 8,
    offsetX   = 0,
    offsetY   = 0,
    direction = 'bottom',
  } = options;

  useLayoutEffect(() => {
    if (!show) return;

    const button = buttonRef.current;
    const menu   = menuRef.current;
    if (!button || !menu) return;

    const rect           = button.getBoundingClientRect();
    const menuWidth      = menu.offsetWidth;
    const menuHeight     = menu.offsetHeight;
    const viewportWidth  = window.innerWidth;
    const viewportHeight = window.innerHeight;

    /* ─────────────── 초기 좌표 ─────────────── */
    let left = 0;
    let top  = 0;

    const placeBottom = () => {
      left = rect.left + offsetX;
      top  = rect.bottom + offsetY;
    };
    const placeTop = () => {
      left = rect.left + offsetX;
      top  = rect.top - menuHeight - offsetY;
    };
    const placeRight = () => {
      left = rect.right + offsetX;
      top  = rect.top + offsetY;
    };
    const placeLeft = () => {
      left = rect.left - menuWidth - offsetX;
      top  = rect.top + offsetY;
    };

    /* ─────────────── 기본 위치 결정 ─────────────── */
    switch (direction) {
      case 'top':    placeTop();    break;
      case 'left':   placeLeft();   break;
      case 'right':  placeRight();  break;
      case 'bottom':
      default:       placeBottom();
    }

    /* ─────────────── 뷰포트 밖이면 반대쪽으로 Fallback ─────────────── */
    const overflowsBottom = top + menuHeight + padding > viewportHeight;
    const overflowsTop    = top < padding;
    const overflowsRight  = left + menuWidth + padding > viewportWidth;
    const overflowsLeft   = left < padding;

    switch (direction) {
      case 'bottom':
        if (overflowsBottom) placeTop();
        break;
      case 'top':
        if (overflowsTop) placeBottom();
        break;
      case 'right':
        if (overflowsRight) placeLeft();
        break;
      case 'left':
        if (overflowsLeft) placeRight();
        break;
    }

    /* ─────────────── 최종 경계 보정 ─────────────── */
    if (left + menuWidth + padding > viewportWidth) {
      left = viewportWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }
    if (top + menuHeight + padding > viewportHeight) {
      top = viewportHeight - menuHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }

    /* ─────────────── 스타일 적용 ─────────────── */
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;
  }, [buttonRef, menuRef, show, padding, offsetX, offsetY, direction]);
}
