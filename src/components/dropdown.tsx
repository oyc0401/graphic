import React, { useLayoutEffect } from "react";
import { paintState } from "../paintState";
import { menuState } from "../ui/menuState";
import { hexToRgb, rgbToHex } from "../utils/color";
import { downloadImage, openFile, resetImage } from "../file";
import { observer } from "mobx-react-lite";
// AppBar.jsx 상단
import MenuIcon from "../assets/menu.svg?react";

import NewIcon from "../assets/new.svg?react";
import OpenIcon from "../assets/open.svg?react";
import SaveIcon from "../assets/save.svg?react";
import { useRef, useEffect } from "react";

export const MainMenuToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    if (menuState.showMenu) {
      menuState.setShowMenu(false);
    }
  });

  useDropdownPosition(buttonRef, menuRef, menuState.showMenu);

  const toggleMenu = () => {
    menuState.setShowMenu(!menuState.showMenu);
  };

  return (
    <>
      <button
        id="menu-button"
        className="header-button"
        onClick={toggleMenu}
        ref={buttonRef}
      >
        <MenuIcon />
      </button>

      {menuState.showMenu && (
        <div id="main-menu" ref={menuRef}>
          <button id="new-button" onClick={resetImage}>
            <NewIcon /> <p>새로 만들기</p>
          </button>
          <button id="open-button" onClick={openFile}>
            <OpenIcon /> <p>열기</p>
          </button>
          <button id="save-button" onClick={downloadImage}>
            <SaveIcon />
            <p>저장</p>
          </button>
        </div>
      )}
    </>
  );
});

export const ColorIndicatorButton = observer(() => {
  const colorHex = rgbToHex(paintState.getColor());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 메뉴 닫기
  useClickOutside([menuRef, buttonRef], () => {
    if (menuState.showColorMenu) {
      menuState.setShowColorMenu(false);
    }
  });

  useDropdownPosition(buttonRef, menuRef, menuState.showColorMenu, {
    offsetX: -15,
  });

  const toggleMenu = () => {
    menuState.setShowColorMenu(!menuState.showColorMenu);
  };

  return (
    <>
      <button
        id="choose-color"
        className="select-button"
        onClick={toggleMenu}
        ref={buttonRef}
      >
        <div
          id="color-icon"
          className="button-icon"
          style={{ background: colorHex }}
        />
        <p>색</p>
      </button>

      {menuState.showColorMenu && (
        <div id="color-menu" ref={menuRef}>
          <button id="selectColor-button">
            <NewIcon /> <p>색깔</p>
          </button>
        </div>
      )}
    </>
  );
});

function useClickOutside(
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
