/**
 * Jawna lista par pokazywanych na /design-system. Klasy Tailwinda są zapisane literalnie,
 * bo Tailwind skanuje źródło statycznie i nie wykryje `bg-${name}`.
 * `design-system.spec.ts` pilnuje, żeby `COLOR_PAIRS` pokrywało wszystkie pary
 * `--X` / `--X-foreground` z `styles.css`.
 */
export interface ColorPair {
  /** Token tła, np. `--primary`: po nim łączymy z parami wykrytymi w CSS. */
  token: string;
  /** Token tekstu, np. `--primary-foreground`. */
  foregroundToken: string;
  label: string;
  /** Klasy próbki (tło + tekst), zapisane literalnie. */
  classes: string;
}

export const COLOR_PAIRS: readonly ColorPair[] = [
  {
    token: '--card',
    foregroundToken: '--card-foreground',
    label: 'Karta',
    classes: 'bg-card text-card-foreground',
  },
  {
    token: '--popover',
    foregroundToken: '--popover-foreground',
    label: 'Okno podręczne',
    classes: 'bg-popover text-popover-foreground',
  },
  {
    token: '--primary',
    foregroundToken: '--primary-foreground',
    label: 'Główny',
    classes: 'bg-primary text-primary-foreground',
  },
  {
    token: '--secondary',
    foregroundToken: '--secondary-foreground',
    label: 'Drugorzędny',
    classes: 'bg-secondary text-secondary-foreground',
  },
  {
    token: '--muted',
    foregroundToken: '--muted-foreground',
    label: 'Przygaszony',
    classes: 'bg-muted text-muted-foreground',
  },
  {
    token: '--accent',
    foregroundToken: '--accent-foreground',
    label: 'Akcent',
    classes: 'bg-accent text-accent-foreground',
  },
  {
    token: '--sidebar',
    foregroundToken: '--sidebar-foreground',
    label: 'Panel boczny',
    classes: 'bg-sidebar text-sidebar-foreground',
  },
  {
    token: '--sidebar-primary',
    foregroundToken: '--sidebar-primary-foreground',
    label: 'Panel boczny: główny',
    classes: 'bg-sidebar-primary text-sidebar-primary-foreground',
  },
  {
    token: '--sidebar-accent',
    foregroundToken: '--sidebar-accent-foreground',
    label: 'Panel boczny: akcent',
    classes: 'bg-sidebar-accent text-sidebar-accent-foreground',
  },
];

export interface StatePair extends ColorPair {
  /** Tekst stanu: stan nigdy nie polega tylko na kolorze (NFR-09). */
  text: string;
}

export const STATE_PAIRS: readonly StatePair[] = [
  {
    token: '--destructive',
    foregroundToken: '--destructive-foreground',
    label: 'Błąd',
    text: 'Błąd',
    classes: 'bg-destructive text-destructive-foreground',
  },
  {
    token: '--warning',
    foregroundToken: '--warning-foreground',
    label: 'Ostrzeżenie',
    text: 'Ostrzeżenie',
    classes: 'bg-warning text-warning-foreground',
  },
  {
    token: '--success',
    foregroundToken: '--success-foreground',
    label: 'Powodzenie',
    text: 'Powodzenie',
    classes: 'bg-success text-success-foreground',
  },
  {
    token: '--info',
    foregroundToken: '--info-foreground',
    label: 'Informacja',
    text: 'Informacja',
    classes: 'bg-info text-info-foreground',
  },
];

/** Wszystkie pary tło / tekst, którymi zajmuje się strona (to je porównuje test pokrycia). */
export const ALL_PAIRS: readonly ColorPair[] = [...COLOR_PAIRS, ...STATE_PAIRS];

/** Co mierzymy na próbce: kolor tekstu, granicy czy konturu. */
export type SampleKind = 'text' | 'border' | 'outline';

export interface ExtraSample {
  id: string;
  label: string;
  /** Próg WCAG: 4,5 dla tekstu (1.4.3), 3 dla elementów interfejsu (1.4.11). */
  minimum: number;
  kind: SampleKind;
  /** Klasy próbki, zapisane literalnie. */
  classes: string;
  /** Kryterium pokazywane obok wyniku. */
  criterion: string;
  tokens: string;
}

/** Pary spoza konwencji `--X` / `--X-foreground`: tekst pomocniczy, granica pola, fokus. */
export const EXTRA_SAMPLES: readonly ExtraSample[] = [
  {
    id: 'page',
    label: 'Tekst na tle strony',
    minimum: 4.5,
    kind: 'text',
    classes: 'bg-background text-foreground',
    criterion: '1.4.3',
    tokens: '--foreground na --background',
  },
  {
    id: 'muted-on-background',
    label: 'Tekst pomocniczy na tle strony',
    minimum: 4.5,
    kind: 'text',
    classes: 'bg-background text-muted-foreground',
    criterion: '1.4.3',
    tokens: '--muted-foreground na --background',
  },
  {
    id: 'muted-on-card',
    label: 'Tekst pomocniczy na karcie',
    minimum: 4.5,
    kind: 'text',
    classes: 'bg-card text-muted-foreground',
    criterion: '1.4.3',
    tokens: '--muted-foreground na --card',
  },
  {
    id: 'muted-on-accent',
    label: 'Tekst pomocniczy na akcencie',
    minimum: 4.5,
    kind: 'text',
    classes: 'bg-accent text-muted-foreground',
    criterion: '1.4.3',
    tokens: '--muted-foreground na --accent',
  },
  {
    id: 'destructive-text',
    label: 'Tekst błędu na tle strony',
    minimum: 4.5,
    kind: 'text',
    classes: 'bg-background text-destructive',
    criterion: '1.4.3',
    tokens: '--destructive na --background',
  },
  {
    id: 'input-border',
    label: 'Granica pola formularza',
    minimum: 3,
    kind: 'border',
    classes: 'bg-background border-2 border-input',
    criterion: '1.4.11',
    tokens: '--input na --background',
  },
  {
    id: 'focus-ring',
    label: 'Pierścień fokusu',
    minimum: 3,
    kind: 'outline',
    classes: 'bg-background outline-2 outline-offset-2 outline-ring',
    criterion: '1.4.11',
    tokens: '--ring na --background',
  },
];
