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
import "./color-box.css";
import { makeAutoObservable } from "mobx";
import { useClickOutside, useDropdownPosition } from "./menu-hooks";
import { colorState, HsvToCss, rgbToCss } from "../colorState";

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
  const colorHex = rgbToHex(colorState.getRGB());
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

  useEffect(() => {
    menuState.showColorMenu = true;
  }, []);

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
      {/* menuState.showColorMenu && */}
      {
        <div id="color-menu" ref={menuRef}>
          <div id={"color-title-box"}>
            <p id={"color-title"}>색 선택</p>
          </div>

          <div id={"color-picker"}></div>

          <input
            id="color-slider"
            type="range"
            min="0"
            max="360"
            className="slider"
            value={colorState.getH()}
            style={{
              "--thumb-color": `${HsvToCss(colorState.getH(), 1, 1)}`,
            }}
            onChange={(e) => {
              colorState.setH(+e.target.value);
              
            }}
          />

          <div id={"color-input-area"}>
            <p>Hex</p>
            <input id="color-input" type="text"></input>
          </div>
        </div>
      }
    </>
  );
});
