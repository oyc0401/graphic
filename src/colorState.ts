import { makeAutoObservable } from "mobx";

class ColorState {
  h = 150;
  s = 0;
  v = 0;

  inputText = "";

  constructor() {
    makeAutoObservable(this);
    this.onChangeColor();
  }

  getRGB() {
    const rgb = hsvToRgb(this.h, this.s, this.v);
    console.log(rgb);
    return rgb;
  }
  setColorFromRGB(r: number, g: number, b: number) {
    let { h, s, v } = rgbToHsv(r, g, b);
    this.h = h;
    this.s = s;
    this.v = v;
    this.onChangeColor();
  }
  setColorFromHex(hexStr) {
    let rgb = hexToRGB(hexStr);
    if (!rgb) {
      return;
    }
    let { r, g, b } = rgb;
    let { h, s, v } = rgbToHsv(r, g, b);
    this.h = h;
    this.s = s;
    this.v = v;
    this.onChangeColor();
  }
  onChangeColor() {
    const { r, g, b } = hsvToRgb(this.h, this.s, this.v);
    this.inputText = rgbToHex(r, g, b);
  }

  setH(h) {
    this.h = h;
    this.onChangeColor();
  }
  getH() {
    return this.h;
  }
  setS(s) {
    this.s = s;
    this.onChangeColor();
  }
  getS() {
    return this.s;
  }
  setV(v) {
    this.v = v;
    this.onChangeColor();
  }
  getV() {
    return this.v;
  }

  setInputText(text) {
    this.inputText = text;
  }
  getInputText() {
    return this.inputText;
  }
}

export const colorState = new ColorState();

function rgbToHsv(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } {
  // 1. 정규화 (0~255 → 0~1)
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  // 2. max, min, delta 계산
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  // 3. Hue 계산
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else if (max === bn) {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  // 4. Saturation 계산
  const s = max === 0 ? 0 : delta / max;

  // 5. Value 계산
  const v = max;

  return { h, s, v };
}

function hsvToRgb(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  const c = v * s; // chroma: 색의 강도
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); // 보조 색
  const m = v - c; // 밝기 조정용

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else if (h >= 300 && h <= 360) {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return { r, g, b };
}

export function rgbToCss(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}
export function HsvToCss(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return `rgb(${r}, ${g}, ${b})`;
}
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16).toUpperCase();
    return hex.length === 1 ? "0" + hex : hex;
  };

  return toHex(r) + toHex(g) + toHex(b);
}

function hexToRGB(hex: string): { r: number; g: number; b: number } | null {
  // 1. 전처리: #이 앞에 붙어있으면 제거
  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }

  // 2. 형식 검증: 정확히 6자리 16진수인지 확인
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  // 3. 파싱
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return { r, g, b };
}
