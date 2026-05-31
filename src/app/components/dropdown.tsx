import React, { useLayoutEffect, useState } from "react";
import { paintState } from "../paintState";
import { menuState } from "../ui/menuState";
import { hexToRgb, rgbToHex } from "../utils/color";
import { downloadImage, openFile, resetImage } from "../file/file";
import { observer } from "mobx-react-lite";
// AppBar.jsx 상단
import MenuIcon from "../assets/menu.svg?react";

import NewIcon from "../assets/new.svg?react";
import OpenIcon from "../assets/open.svg?react";
import SaveIcon from "../assets/save.svg?react";
import TranslateIcon from "../assets/translate.svg?react";
import { Bug } from "lucide-react";

import { useRef, useEffect } from "react";
import "./color-box.css";
import { makeAutoObservable } from "mobx";
import {
  useClickOutside,
  useDropdownPosition,
  useDropdownPosition2,
} from "./menu-hooks";
import { colorState, HsvToCss, rgbToCss } from "../colorState";
import { getLetter } from "../i18n/language";
import { historyState } from "../history";

const BUG_REPORT_FORM_URL = "https://forms.gle/P93ZSJqSUBEWEpB79";

const openBugReportForm = () => {
  window.open(BUG_REPORT_FORM_URL, "_blank", "noopener,noreferrer");
  menuState.setShowMenu(false);
};

const resetImageAndCloseMenu = () => {
  if (
    historyState.getUndoCount() + historyState.getRedoCount() > 0 &&
    !window.confirm(getLetter("new_file_confirm"))
  ) {
    return;
  }

  menuState.setShowMenu(false);
  resetImage();
};

export const MainMenuToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: PointerEvent) => {
      const target = event.target as Node;
      const languageMenu = document.getElementById("languageMenu");
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target) ||
        languageMenu?.contains(target)
      ) {
        return;
      }
      if (menuState.showMenu) {
        menuState.setShowMenu(false);
      }
    };

    document.addEventListener("pointerdown", listener);
    return () => {
      document.removeEventListener("pointerdown", listener);
    };
  }, []);

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
          <button id="new-button" onClick={resetImageAndCloseMenu}>
            <div className="menu-button-content">
              <NewIcon /> <p>{getLetter("new")}</p>
            </div>
          </button>
          <button id="open-button" onClick={openFile}>
            <div className="menu-button-content">
              <OpenIcon /> <p>{getLetter("open")}</p>
            </div>
          </button>
          <button id="save-button" onClick={downloadImage}>
            <div className="menu-button-content">
              <SaveIcon />
              <p>{getLetter("save")}</p>
            </div>
          </button>
          <button id="bug-report-button" onClick={openBugReportForm}>
            <div className="menu-button-content">
              <Bug />
              <p>{getLetter("bug_report")}</p>
            </div>
          </button>
          <LanguageMenuToggleButton />
        </div>
      )}
    </>
  );
});

export const LanguageMenuToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const getLanguageMenu = () => document.getElementById("languageMenu");

  const getRouteTool = () => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length === 1 && isLanguageRouteTool(segments[0])) {
      return segments[0];
    }
    if (segments.length === 2 && isLanguageRouteTool(segments[1])) {
      return segments[1];
    }
    return null;
  };

  const languageHref = (lang: string) => {
    const tool = getRouteTool();
    const path = tool ? `/${lang}/${tool}` : `/${lang}`;
    return `${path}${window.location.search}${window.location.hash}`;
  };

  const updateLanguageLinks = () => {
    const menu = getLanguageMenu();
    if (!menu) return;

    menu.querySelectorAll<HTMLAnchorElement>("a[data-lang]").forEach((link) => {
      const lang = link.dataset.lang;
      if (!lang) return;
      link.href = languageHref(lang);
    });
  };

  const closeMenu = () => {
    getLanguageMenu()?.classList.add("hide");
    setOpen(false);
  };

  const positionMenu = () => {
    const button = buttonRef.current;
    const menu = getLanguageMenu();
    if (!button || !menu) return;

    const padding = 0;
    const rect = button.getBoundingClientRect();
    updateLanguageLinks();
    menu.classList.remove("hide");

    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right;
    if (left + menuRect.width + padding > viewportWidth) {
      left = rect.left - menuRect.width;
    }
    if (left + menuRect.width + padding > viewportWidth) {
      left = viewportWidth - menuRect.width - padding;
    }
    if (left < padding) {
      left = padding;
    }

    let top = rect.top;
    if (top + menuRect.height + padding > viewportHeight) {
      top = viewportHeight - menuRect.height - padding;
    }
    if (top < padding) {
      top = padding;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  };

  useLayoutEffect(() => {
    if (!open) {
      getLanguageMenu()?.classList.add("hide");
      return;
    }

    positionMenu();

    const onPointerDown = (event: PointerEvent) => {
      const button = buttonRef.current;
      const menu = getLanguageMenu();
      const target = event.target as Node;
      if (button?.contains(target) || menu?.contains(target)) return;
      closeMenu();
    };

    const onReposition = () => {
      if (open) positionMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    const resizeObserver = new ResizeObserver(onReposition);
    const button = buttonRef.current;
    const menu = getLanguageMenu();
    if (button) resizeObserver.observe(button);
    if (menu) resizeObserver.observe(menu);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      resizeObserver.disconnect();
    };
  }, [open]);

  useEffect(() => {
    return () => {
      getLanguageMenu()?.classList.add("hide");
    };
  }, []);

  const toggleMenu = () => {
    setOpen((nextOpen) => !nextOpen);
  };

  return (
    <button
      id="language-button"
      onClick={toggleMenu}
      ref={buttonRef}
      aria-expanded={open}
      aria-controls="languageMenu"
    >
      <div className="menu-button-content">
        <TranslateIcon />
        <p>Language</p>
      </div>
    </button>
  );
});

function isLanguageRouteTool(segment: string) {
  return segment === "liquify" || segment === "mosaic";
}

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
      <button className="select-button" onClick={toggleMenu} ref={buttonRef}>
        <div
          id="color-icon"
          className="button-icon"
          style={{ background: colorHex }}
        />
        <p>{getLetter("color")}</p>
      </button>

      <div
        id="color-menu"
        style={{ visibility: menuState.showColorMenu ? "visible" : "hidden" }}
        ref={menuRef}
      >
        <div id={"color-title-box"}>
          <p id={"color-title"}>{getLetter("choose_color")}</p>
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

export const MobileColorIndicatorButton = observer(() => {
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
    padding: 0,
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

    field.addEventListener("pointerdown", onMouseDown);
    window.addEventListener("pointermove", onMouseMove);
    window.addEventListener("pointerup", onMouseUp);

    return () => {
      field.removeEventListener("pointerdown", onMouseDown);
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("pointerup", onMouseUp);
    };
  }, []);

  return (
    <>
      <button className="header-button" onClick={toggleMenu} ref={buttonRef}>
        <div className="mobile-color-icon" style={{ background: colorHex }} />
      </button>

      <div
        id="color-menu"
        style={{ visibility: menuState.showColorMenu ? "visible" : "hidden" }}
        ref={menuRef}
      >
        <div id={"color-title-box"}>
          <p id={"color-title"}>{getLetter("choose_color")}</p>
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
