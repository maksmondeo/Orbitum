/** Kolor w liniowej przestrzeni sRGB, kanały 0–1 (tak liczy luminancję WCAG). */
export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** sRGB (gamma) -> liniowy, wzór z WCAG 2.1. */
function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(input: string): LinearRgb {
  const hex = input.slice(1);
  const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error(`Nieobsługiwany zapis hex: "${input}"`);
  }
  const channel = (i: number) => srgbToLinear(parseInt(full.slice(i, i + 2), 16) / 255);
  return { r: channel(0), g: channel(2), b: channel(4) };
}

/**
 * Składnik oklch: liczba (0.205), procent (20.5%) albo `none` (= 0).
 * `percentScale` to wartość odpowiadająca 100% (1 dla L, 0.4 dla C).
 */
function parseOklchComponent(raw: string, percentScale: number): number {
  if (raw === 'none') return 0;
  if (raw.endsWith('%')) return (parseFloat(raw) / 100) * percentScale;
  return parseFloat(raw.replace(/deg$/, ''));
}

/** oklch -> liniowy sRGB (macierze Oklab Björna Ottossona), z obcięciem do gamutu. */
function oklchToLinearRgb(L: number, C: number, hDeg: number): LinearRgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const OKLCH = /^oklch\(\s*(\S+)\s+(\S+)\s+(\S+)\s*\)$/i;

/**
 * Parsuje kolor z CSS: `#rgb`, `#rrggbb`, `oklch(L C H)` (liczby, procenty, `none`).
 * Rzuca wyjątek dla każdego innego zapisu (też z kanałem alfa): kontrast
 * półprzezroczystego koloru zależy od tła, więc nie zgadujemy.
 */
export function parseColor(input: string): LinearRgb {
  const value = input.trim();
  if (value.startsWith('#')) return parseHex(value);

  const match = OKLCH.exec(value);
  if (match) {
    const [, l, c, h] = match;
    const components = [
      parseOklchComponent(l, 1),
      parseOklchComponent(c, 0.4),
      parseOklchComponent(h, 1),
    ];
    if (components.some(Number.isNaN)) {
      throw new Error(`Nie udało się sparsować składników oklch: "${input}"`);
    }
    return oklchToLinearRgb(components[0], components[1], components[2]);
  }

  throw new Error(`Nieobsługiwany zapis koloru: "${input}"`);
}

/** Luminancja względna wg WCAG 2.1 (0 = czerń, 1 = biel). */
export function relativeLuminance(color: LinearRgb): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** Współczynnik kontrastu WCAG 2.1, 1–21. Kolejność argumentów nie ma znaczenia. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseColor(a));
  const lb = relativeLuminance(parseColor(b));
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}
