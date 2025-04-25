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
  },
) {
  const padding = options?.padding ?? 8;
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;

  useLayoutEffect(() => {
    if (!show) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 1️⃣ offset을 먼저 적용
    let left = rect.left + offsetX;
    let top = rect.bottom + offsetY;

    // 2️⃣ offset 반영된 위치 기준으로 튐 방지 적용
    if (left + menuWidth + padding > viewportWidth) {
      left = viewportWidth - menuWidth - padding;
    }

    if (left < padding) {
      left = padding; // 왼쪽도 화면 밖으로 나가면 보정
    }

    if (top + menuHeight + padding > viewportHeight) {
      top = rect.top - menuHeight;
    }

    if (top < padding) {
      top = padding;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [buttonRef, menuRef, show, padding, offsetX, offsetY]);
}
