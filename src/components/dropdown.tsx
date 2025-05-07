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

  useDropdownPosition(buttonRef, menuRef, menuState.showMenu, {
    padding: 0,
  });

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
    offsetY: 4,
  });

  const toggleMenu = () => {
    menuState.setShowColorMenu(!menuState.showColorMenu);
  };

  useEffect(() => {
    // menuState.showColorMenu = true;
  }, []);

  const fieldRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    let dragging = false;

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      movePicker(e);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        movePicker(e);
      }
    };

    const onMouseUp = () => {
      dragging = false;
    };

    const movePicker = (e: MouseEvent) => {
      const rect = field.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = rect.bottom - e.clientY; // y축 뒤집기 (bottom 기준)

      // clamp
      x = Math.max(0, Math.min(200, x));
      y = Math.max(0, Math.min(200, y));

      // 비율로 변환 (0~1)
      const s = x / 200;
      const v = y / 200;

      // 바로 저장
      colorState.setS(s);
      colorState.setV(v);
    };

    field.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      field.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
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

      <div
        id="color-menu"
        style={{ visibility: menuState.showColorMenu ? "visible" : "hidden" }}
        ref={menuRef}
      >
        <div id={"color-title-box"}>
          <p id={"color-title"}>색 선택</p>
        </div>

        <div
          id={"color-field"}
          ref={fieldRef}
          style={{ "--field-end-color": HsvToCss(colorState.getH(), 1, 1) }}
        >
          <div
            id="color-picker"
            ref={pickerRef}
            style={{
              left: colorState.getS() * 200 - 10,
              bottom: colorState.getV() * 200 - 10,
              background: colorHex,
            }}
          ></div>
        </div>

        <input
          id="color-h-slider"
          type="range"
          min="0"
          max="360"
          className="color-slider"
          value={colorState.getH()}
          style={{
            "--thumb-h-color": HsvToCss(colorState.getH(), 1, 1),
          }}
          onChange={(e) => {
            colorState.setH(+e.target.value);
          }}
        />
        <input
          id="color-s-slider"
          type="range"
          min="0"
          max="100"
          className="color-slider"
          value={colorState.getS() * 100}
          style={{
            "--thumb-s-color": `${HsvToCss(colorState.getH(), colorState.getS(), 0.5 + 0.5 * colorState.getS())}`,
            "--thumb-s-start-color": `${HsvToCss(colorState.getH(), 0, 0.5)}`,
            "--thumb-s-end-color": `${HsvToCss(colorState.getH(), 1, 1)}`,
          }}
          onChange={(e) => {
            colorState.setS(+e.target.value / 100);
          }}
        />
        <input
          id="color-v-slider"
          type="range"
          min="0"
          max="100"
          className="color-slider"
          value={colorState.getV() * 100}
          style={{
            "--thumb-v-color": `${HsvToCss(1, 0, colorState.getV())}`,
          }}
          onChange={(e) => {
            colorState.setV(+e.target.value / 100);
          }}
        />

        <div id={"color-input-area"}>
          <p id="color-type">Hex</p>
          <div className="div-bar" style={{ height: "20px" }}></div>
          <input
            id="color-input"
            type="text"
            value={colorState.getInputText()}
            onChange={(e) => {
              colorState.setInputText(e.target.value);
              colorState.setColorFromHex(e.target.value);
            }}
            onBlur={() => {
              console.log("input blur (나감)");
              let hexStr = colorState.autoComplete();
              colorState.setInputText(hexStr);
              colorState.setColorFromHex(hexStr);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                console.log("input enter");
                (e.target as HTMLInputElement).blur();
              }
            }}
          ></input>
        </div>
      </div>
    </>
  );
});
