import { GridPoint } from '../forecast/forecast-types';
import { ColorScale, colorAt } from './color-scale';

/** Rogi obrazu w stopniach. Obejmują siatkę powiększoną o pół komórki z każdej strony. */
export interface GridBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export interface GridImage {
  width: number;
  height: number;
  /** Piksele wiersz po wierszu, od północy (góra) do południa, 4 liczby (R, G, B, A) na piksel. */
  rgba: Uint8ClampedArray;
  bounds: GridBounds;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Pozycja szerokości geograficznej (w stopniach) na osi pionowej mapy w odwzorowaniu Mercatora. */
function mercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * DEGREES_TO_RADIANS) / 2));
}

/** Odwrotność `mercatorY`: z pozycji na osi pionowej mapy z powrotem na szerokość w stopniach. */
function latFromMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEGREES_TO_RADIANS;
}

/** Najmniejsza odległość między sąsiednimi wartościami (krok siatki). Jedna wartość daje `Infinity`. */
function smallestStep(values: number[]): number {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < sorted.length; i++) step = Math.min(step, sorted[i] - sorted[i - 1]);
  return step;
}

/** Gdy siatka ma tylko jeden wiersz albo kolumnę, brakujący krok bierzemy z drugiej osi. */
function stepOrFallback(step: number, otherStep: number): number {
  if (Number.isFinite(step)) return step;
  return Number.isFinite(otherStep) ? otherStep : 1;
}

/**
 * Wartość siatki w punkcie leżącym między węzłami. `row` i `col` to numery wierszy (od południa)
 * i kolumn (od zachodu), ułamkowe, np. `col = 1,4` leży 40% drogi od kolumny 1 do kolumny 2.
 *
 * Mieszamy wartości czterech otaczających węzłów (interpolacja dwuliniowa). Brakujące węzły
 * pomijamy, a wagi pozostałych przeliczamy tak, żeby dawały razem 1. Jeśli najbliższy węzeł
 * jest sam brakujący, wynikiem jest `NaN` (dziura zostaje dziurą, nie jest zasypywana sąsiadami).
 */
function sampleGrid(
  values: Float64Array,
  rowCount: number,
  colCount: number,
  row: number,
  col: number,
): number {
  // Piksele z pasa pół komórki przy krawędzi dostają wartość skrajnego węzła.
  const r = Math.min(Math.max(row, 0), rowCount - 1);
  const c = Math.min(Math.max(col, 0), colCount - 1);

  const nearest = values[Math.round(r) * colCount + Math.round(c)];
  if (Number.isNaN(nearest)) return NaN;

  const rowBelow = Math.floor(r);
  const colLeft = Math.floor(c);
  const rowAbove = Math.min(rowBelow + 1, rowCount - 1);
  const colRight = Math.min(colLeft + 1, colCount - 1);
  const rowShare = r - rowBelow;
  const colShare = c - colLeft;

  const neighbours = [
    { value: values[rowBelow * colCount + colLeft], weight: (1 - rowShare) * (1 - colShare) },
    { value: values[rowBelow * colCount + colRight], weight: (1 - rowShare) * colShare },
    { value: values[rowAbove * colCount + colLeft], weight: rowShare * (1 - colShare) },
    { value: values[rowAbove * colCount + colRight], weight: rowShare * colShare },
  ].filter((neighbour) => !Number.isNaN(neighbour.value));

  const totalWeight = neighbours.reduce((sum, neighbour) => sum + neighbour.weight, 0);
  return neighbours.reduce((sum, n) => sum + (n.value * n.weight) / totalWeight, 0);
}

/**
 * Zamienia punkty siatki prognozy na piksele rastra do źródła `image` w MapLibre.
 *
 * - Granice i krok siatki wynikają z danych, nie ze stałych backendu. Punktów może brakować.
 * - Wartość interpolujemy między węzłami, a dopiero potem zamieniamy na kolor (przez `scale`),
 *   dzięki czemu kolor na mapie zgadza się z legendą.
 * - MapLibre rozciąga obraz równomiernie w odwzorowaniu Mercatora, a dane są równomierne w
 *   szerokości geograficznej. Dlatego dla każdego wiersza pikseli liczymy, jakiej szerokości
 *   odpowiada na mapie, i dopiero dla niej próbkujemy siatkę.
 * - Zwraca `null` dla pustej listy (stan „brak prognozy”).
 */
export function gridToImage(
  points: GridPoint[],
  scale: ColorScale,
  pxPerCell = 8,
): GridImage | null {
  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const rawLatStep = smallestStep(lats);
  const rawLonStep = smallestStep(lons);
  const latStep = stepOrFallback(rawLatStep, rawLonStep);
  const lonStep = stepOrFallback(rawLonStep, rawLatStep);

  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const rowCount = Math.round((Math.max(...lats) - minLat) / latStep) + 1;
  const colCount = Math.round((Math.max(...lons) - minLon) / lonStep) + 1;

  // Wiersze liczymy od południa, tak jak rosną współrzędne. Brakujące węzły zostają `NaN`.
  const values = new Float64Array(rowCount * colCount).fill(NaN);
  for (const point of points) {
    const row = Math.round((point.lat - minLat) / latStep);
    const col = Math.round((point.lon - minLon) / lonStep);
    values[row * colCount + col] = point.value;
  }

  const bounds: GridBounds = {
    north: minLat + (rowCount - 1) * latStep + latStep / 2,
    south: minLat - latStep / 2,
    west: minLon - lonStep / 2,
    east: minLon + (colCount - 1) * lonStep + lonStep / 2,
  };

  // Wysokość dobrana tak, żeby piksele były kwadratowe na mapie (po rozciągnięciu w Mercatorze).
  const width = colCount * pxPerCell;
  const mercatorNorth = mercatorY(bounds.north);
  const mercatorSouth = mercatorY(bounds.south);
  const lonSpan = (bounds.east - bounds.west) * DEGREES_TO_RADIANS;
  const height = Math.max(1, Math.round((width * (mercatorNorth - mercatorSouth)) / lonSpan));

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    // Pionowo piksele są równo rozłożone w Mercatorze, więc najpierw pozycja, potem szerokość.
    const shareFromNorth = (py + 0.5) / height;
    const lat = latFromMercatorY(mercatorNorth - shareFromNorth * (mercatorNorth - mercatorSouth));
    // Środek komórki to liczba całkowita, stąd odjęte pół komórki.
    const row = (lat - bounds.south) / latStep - 0.5;

    for (let px = 0; px < width; px++) {
      const col = ((px + 0.5) / width) * colCount - 0.5;
      rgba.set(colorAt(scale, sampleGrid(values, rowCount, colCount, row, col)), (py * width + px) * 4);
    }
  }

  return { width, height, rgba, bounds };
}
