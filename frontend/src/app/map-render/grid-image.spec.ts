import { GridPoint } from '../forecast/forecast-types';
import { ColorScale } from './color-scale';
import { GridImage, gridToImage } from './grid-image';

// Wartość 10 daje [40, 0, 0], 50 daje [200, 0, 0], 90 daje [200, 160, 160].
// Wartości 10 i 90 leżą po dwóch stronach stopnia 50, więc mieszanie wartości i mieszanie
// kolorów dają różne wyniki.
const scale: ColorScale = {
  label: 'Test',
  unit: 'u',
  stops: [
    { value: 0, color: [0, 0, 0] },
    { value: 50, color: [200, 0, 0] },
    { value: 100, color: [200, 200, 200] },
  ],
};

/** Siatka z wierszy zapisanych od północy (jak na mapie): lat 52, 51, 50, lon 14, 15, 16. `null` = brak węzła. */
function makeGrid(rows: (number | null)[][]): GridPoint[] {
  return rows.flatMap((row, i) =>
    row.flatMap((value, j) => (value === null ? [] : [{ lat: 52 - i, lon: 14 + j, value }])),
  );
}

/** Kolor piksela [R, G, B, A] w kolumnie `x` i wierszu `y` (wiersz 0 to północ). */
function pixel(image: GridImage, x: number, y: number) {
  const start = (y * image.width + x) * 4;
  return Array.from(image.rgba.slice(start, start + 4));
}

describe('gridToImage', () => {
  // pxPerCell = 5: środek komórki k leży dokładnie w pikselu 5k + 2.
  const px = 5;

  it('pusta lista daje null', () => {
    expect(gridToImage([], scale)).toBeNull();
  });

  it('środek komórki ma dokładnie kolor węzła', () => {
    const image = gridToImage(makeGrid([[10, 90, 10]]), scale, px)!;
    expect(pixel(image, 2, 0)).toEqual([40, 0, 0, 255]);
    expect(pixel(image, 7, 0)).toEqual([200, 160, 160, 255]);
  });

  it('punkt pośredni ma kolor interpolowanej wartości, a nie średnią kolorów węzłów', () => {
    const image = gridToImage(makeGrid([[10, 90, 10]]), scale, px)!;
    // Piksel 4 leży 40% drogi od węzła 10 do 90, czyli ma wartość 42, a ta ma kolor [168, 0, 0].
    // Średnia kolorów węzłów dałaby [104, 64, 64].
    expect(pixel(image, 4, 0)).toEqual([168, 0, 0, 255]);
  });

  it('brakujący węzeł daje piksele przezroczyste, a reszta jest kryjąca', () => {
    const image = gridToImage(makeGrid([[10, 10, 10], [10, null, 10], [10, 10, 10]]), scale, px)!;
    expect(pixel(image, 7, Math.floor(image.height / 2))[3]).toBe(0);
    expect(pixel(image, 2, 0)[3]).toBe(255);
  });

  it('północ jest u góry obrazu', () => {
    const image = gridToImage(makeGrid([[10, 10, 10], [50, 50, 50], [90, 90, 90]]), scale, px)!;
    expect(pixel(image, 7, 0)).toEqual([40, 0, 0, 255]);
    expect(pixel(image, 7, image.height - 1)).toEqual([200, 160, 160, 255]);
  });

  it('granice to dane powiększone o pół komórki', () => {
    const image = gridToImage(makeGrid([[1, 1, 1], [1, 1, 1], [1, 1, 1]]), scale)!;
    expect(image.bounds).toEqual({ north: 52.5, south: 49.5, west: 13.5, east: 16.5 });
  });

  it('wiersze są rozłożone według Mercatora, a nie równo w szerokości geograficznej', () => {
    // Wartość to szerokość geograficzna, więc kolor piksela mówi, z jakiej szerokości pochodzi.
    // Obraz obejmuje 10–70° N. Środek obrazu leży na ok. 47°, a nie na 40° (środek liniowy).
    const points = [20, 40, 60].flatMap((lat) => [10, 30].map((lon) => ({ lat, lon, value: lat })));
    const lineScale: ColorScale = {
      ...scale,
      stops: [
        { value: 0, color: [0, 0, 0] },
        { value: 100, color: [100, 100, 100] },
      ],
    };
    const image = gridToImage(points, lineScale)!;
    const red = pixel(image, 0, Math.floor(image.height / 2))[0];
    expect(red).toBeGreaterThanOrEqual(45);
    expect(red).toBeLessThanOrEqual(49);
  });
});
