import { makeAutoObservable } from "mobx";

class ColorState {
  h = 0;
  s = 0;
  v = 0;

  constructor() {
    makeAutoObservable(this);
  }

  getRGB() {
    const rgb = hsvToRgb(this.h, this.s, this.v);
    console.log(rgb)
    return rgb
  }
  setColorFromRGB(r: number, g: number, b: number) {
    let { h, s, v } = rgbToHsv(r, g, b);
    this.h = h;
    this.s = s;
    this.v = v;
  }
  setH(h) {
    this.h = h;
  }
  getH() {
    return this.h;
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