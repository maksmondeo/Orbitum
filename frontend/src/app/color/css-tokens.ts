/** Mapa deklaracji `--nazwa` -> wartość tak, jak jest zapisana w CSS (np. `var(--color-neutral-900)`). */
export type TokenMap = Map<string, string>;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Wyciąga wszystkie deklaracje własnych właściwości z fragmentu CSS. */
export function parseDeclarations(css: string): TokenMap {
  const tokens: TokenMap = new Map();
  for (const [, name, value] of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

/**
 * Tokeny z bloku `:root { ... }` (tryb jasny). `:root.dark` nie pasuje do wzorca,
 * bo między `:root` a `{` stoi `.dark`.
 */
export function parseRootTokens(css: string): TokenMap {
  const match = /:root\s*\{([^}]*)\}/.exec(stripComments(css));
  if (!match) throw new Error('Brak bloku :root w CSS');
  return parseDeclarations(match[1]);
}

/**
 * Rozwiązuje token do wartości koloru, idąc po łańcuchu `var(--x)`.
 * Szuka w podanych zakresach po kolei (np. `:root`, potem skala bazowa Tailwinda).
 * Rzuca wyjątek dla brakującej zmiennej i dla cyklu: nigdy nie zwraca pustki po cichu.
 */
export function resolveToken(name: string, ...scopes: TokenMap[]): string {
  const seen: string[] = [];
  let current = name;
  for (;;) {
    if (seen.includes(current)) {
      throw new Error(`Cykl w tokenach: ${[...seen, current].join(' -> ')}`);
    }
    seen.push(current);

    const value = scopes.map((scope) => scope.get(current)).find((v) => v !== undefined);
    if (value === undefined) {
      throw new Error(`Nie znaleziono tokenu ${current} (łańcuch: ${seen.join(' -> ')})`);
    }

    const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
    if (!reference) return value;
    current = reference[1];
  }
}

export interface TokenPair {
  /** Nazwa tokenu tła, np. `--primary`. */
  background: string;
  /** Nazwa tokenu tekstu, np. `--primary-foreground`. */
  foreground: string;
}

/** Każde `--X` z istniejącym `--X-foreground`: konwencja spartana dla par tło/tekst. */
export function discoverForegroundPairs(tokens: TokenMap): TokenPair[] {
  return [...tokens.keys()]
    .filter((name) => name.endsWith('-foreground') && tokens.has(name.replace(/-foreground$/, '')))
    .map((foreground) => ({ background: foreground.replace(/-foreground$/, ''), foreground }));
}
