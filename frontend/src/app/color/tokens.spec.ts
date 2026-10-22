/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from './contrast';
import {
  discoverForegroundPairs,
  parseDeclarations,
  parseRootTokens,
  resolveToken,
} from './css-tokens';

/** `ng test` uruchamia się w katalogu projektu (frontend/). */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const root = parseRootTokens(read('src/styles.css'));
const tailwindTheme = parseDeclarations(read('node_modules/tailwindcss/theme.css'));

const color = (token: string) => resolveToken(token, root, tailwindTheme);

/** WCAG 1.4.3: tekst zwykły. */
const TEXT = 4.5;
/** WCAG 1.4.11: elementy interfejsu i granice kontrolek. */
const NON_TEXT = 3;

function expectContrast(foreground: string, background: string, minimum: number) {
  const ratio = contrastRatio(color(foreground), color(background));
  expect(
    ratio,
    `${foreground} na ${background}: ${ratio.toFixed(2)}:1, wymagane ${minimum}:1`,
  ).toBeGreaterThanOrEqual(minimum);
}

describe('tokeny: pary tło / tekst (wykryte automatycznie)', () => {
  const pairs = discoverForegroundPairs(root);

  it('wykrywa pary w :root (strażnik przed pustym testem)', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(10);
  });

  it.each(pairs.map((p) => [`${p.foreground} na ${p.background}`, p] as const))(
    '%s >= 4,5:1',
    (_label, pair) => {
      expectContrast(pair.foreground, pair.background, TEXT);
    },
  );
});

describe('tokeny: pary wskazane jawnie', () => {
  // Tekst pomocniczy kładziony na różnych powierzchniach.
  const mutedSurfaces = ['--background', '--card', '--muted', '--accent'];
  it.each(mutedSurfaces)('--muted-foreground na %s >= 4,5:1', (surface) => {
    expectContrast('--muted-foreground', surface, TEXT);
  });

  it('--destructive jako tekst błędu na --background >= 4,5:1', () => {
    expectContrast('--destructive', '--background', TEXT);
  });

  // Granica pola formularza jest elementem interfejsu (1.4.11), a nie dekoracją.
  it('--input (granica pola) na --background >= 3:1', () => {
    expectContrast('--input', '--background', NON_TEXT);
  });

  it('--ring (pierścień fokusu) na --background >= 3:1', () => {
    expectContrast('--ring', '--background', NON_TEXT);
  });

  // Świadomie poza testem:
  // - `--border`: czysto dekoracyjny separator, zwolniony z 1.4.11.
  // - `--warning` jako tekst na tle: żółty nie osiągnie 4,5:1 na białym,
  //   dlatego stan ostrzeżenia jest tylko wypełniony (--warning + --warning-foreground).
});

describe('css-tokens', () => {
  it('rozwiązuje łańcuch var() przez kolejne zakresy', () => {
    const a = new Map([['--a', 'var(--b)']]);
    const b = new Map([['--b', '#fff']]);
    expect(resolveToken('--a', a, b)).toBe('#fff');
  });

  it('rzuca wyjątek z nazwą tokenu, gdy zmiennej brakuje', () => {
    expect(() => resolveToken('--a', new Map([['--a', 'var(--nie-ma)']]))).toThrow(/--nie-ma/);
  });

  it('rzuca wyjątek przy cyklu', () => {
    const cycle = new Map([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ]);
    expect(() => resolveToken('--a', cycle)).toThrow(/Cykl/);
  });

  it(':root nie miesza się z :root.dark', () => {
    const tokens = parseRootTokens(':root { --x: #000; } :root.dark { --x: #fff; --y: #fff; }');
    expect(tokens.get('--x')).toBe('#000');
    expect(tokens.has('--y')).toBe(false);
  });
});
