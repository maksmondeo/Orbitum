/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverForegroundPairs, parseRootTokens } from './css-tokens';
import { ALL_PAIRS, COLOR_PAIRS, EXTRA_SAMPLES, STATE_PAIRS } from './pairs';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const key = (p: { background: string; foreground: string }) => `${p.background} / ${p.foreground}`;

describe('/design-system: pokrycie par z styles.css', () => {
  const fromCss = discoverForegroundPairs(parseRootTokens(css)).map(key).sort();
  const fromPage = ALL_PAIRS.map((p) =>
    key({ background: p.token, foreground: p.foregroundToken }),
  ).sort();

  it('strona pokazuje dokładnie te pary, które są w CSS', () => {
    expect(fromPage).toEqual(fromCss);
  });

  it('nie powtarza par', () => {
    expect(new Set(fromPage).size).toBe(fromPage.length);
  });

  it('klasy próbek nie odwołują się do gołej palety Tailwinda', () => {
    const classes = [...COLOR_PAIRS, ...STATE_PAIRS, ...EXTRA_SAMPLES].map((s) => s.classes);
    for (const c of classes) {
      expect(c, c).not.toMatch(
        /\b(?:bg|text|border|outline)-(?:red|green|blue|yellow|neutral|gray)-/,
      );
    }
  });
});
