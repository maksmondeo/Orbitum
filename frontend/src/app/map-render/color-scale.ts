import { Variable } from '../forecast/forecast-types';

export type Rgb = [number, number, number];
export type Rgba = [number, number, number, number];

export interface ColorStop {
  value: number;
  color: Rgb;
}

export interface ColorScale {
  /** Rosnąco po `value`. Kolor między stopniami to interpolacja liniowa w RGB. */
  stops: ColorStop[];
  unit: string;
  label: string;
}

/** Zapis koloru jako `#rrggbb` jest czytelniejszy w tabeli stopni niż trzy liczby. */
function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Skale kolorów danych na mapie (wyjątek od zasady „tylko tokeny”, patrz `frontend/CLAUDE.md`).
 * Raster i legenda czytają stopnie z tego samego miejsca.
 *
 * Temperatura: ze stopniem neutralnym w 0 °C. Zimno to niebieski, potem zieleń (chłodno,
 * ok. 5–12 °C), żółty (ciepło), pomarańczowy i czerwień dopiero przy upale. Granica mrozu
 * jest widoczna jako zmiana barwy, a nie tylko jaśniejszy odcień. Zieleń leży między
 * niebieskim a żółtym, daleko od czerwieni, żeby nie tworzyć pary czerwony–zielony obok siebie.
 * Ciśnienie: skala sekwencyjna w jednym odcieniu (fiolet), jaśniej = niżej
 */
export const SCALES: Record<Variable, ColorScale> = {
  temperature_2m: {
    label: 'Temperatura',
    unit: '°C',
    stops: [
      { value: -20, color: rgb('#0d366b') },
      { value: -10, color: rgb('#256abf') },
      { value: -5, color: rgb('#86b6ef') },
      { value: 0, color: rgb('#f0efec') },
      { value: 6, color: rgb('#c2ebc2') },
      { value: 12, color: rgb('#96d987') },
      { value: 18, color: rgb('#f2d76c') },
      { value: 24, color: rgb('#f28f29') },
      { value: 30, color: rgb('#da4620') },
      { value: 35, color: rgb('#79191b') },
    ],
  },
  pressure_msl: {
    label: 'Ciśnienie',
    unit: 'hPa',
    stops: [
      { value: 980, color: rgb('#e4e1fb') },
      { value: 990, color: rgb('#c3bee9') },
      { value: 1000, color: rgb('#a39bda') },
      { value: 1010, color: rgb('#8678c9') },
      { value: 1020, color: rgb('#6a57b3') },
      { value: 1030, color: rgb('#4f3a92') },
      { value: 1040, color: rgb('#35226a') },
    ],
  },
};

const TRANSPARENT: Rgba = [0, 0, 0, 0];

/**
 * Kolor, jakim na mapie i w legendzie rysujemy daną wartość (np. temperaturę).
 *
 * Skala ma kilka stopni (np. 0 °C = szary, 10 °C = zielony). Dla wartości leżącej między
 * dwoma stopniami mieszamy ich kolory proporcjonalnie do tego, jak daleko wartość jest
 * od każdego z nich. Przykład: 5 °C leży w połowie drogi między stopniami 0 i 10 °C,
 * więc dostaje po 50% koloru każdego z nich (każdy kanał R, G, B liczymy osobno).
 *
 * - wartość poniżej pierwszego lub powyżej ostatniego stopnia dostaje kolor skrajnego stopnia,
 * - `NaN` (brak danych) daje kolor przezroczysty,
 * - wynik to `[R, G, B, A]`, każda liczba 0–255; A = 255 oznacza kolor w pełni kryjący.
 */
export function colorAt(scale: ColorScale, value: number): Rgba {
  if (Number.isNaN(value)) return TRANSPARENT;

  const { stops } = scale;
  const lowestStop = stops[0];
  const highestStop = stops[stops.length - 1];
  if (value <= lowestStop.value) return [...lowestStop.color, 255];
  if (value >= highestStop.value) return [...highestStop.color, 255];

  // Szukamy dwóch stopni, między którymi leży wartość: najbliższy poniżej i najbliższy powyżej.
  const aboveIndex = stops.findIndex((stop) => stop.value >= value);
  const stopBelow = stops[aboveIndex - 1];
  const stopAbove = stops[aboveIndex];

  // 0 = wartość dokładnie na stopniu niższym, 1 = na wyższym, 0,5 = w połowie drogi.
  const shareOfWay = (value - stopBelow.value) / (stopAbove.value - stopBelow.value);

  // Wartość jednego kanału koloru (R, G albo B) po przejściu części drogi od niższego do wyższego.
  const blendChannel = (channelBelow: number, channelAbove: number) =>
    Math.round(channelBelow + (channelAbove - channelBelow) * shareOfWay);

  return [
    blendChannel(stopBelow.color[0], stopAbove.color[0]),
    blendChannel(stopBelow.color[1], stopAbove.color[1]),
    blendChannel(stopBelow.color[2], stopAbove.color[2]),
    255,
  ];
}
