const SENTINEL = '#010203';

let context: CanvasRenderingContext2D | null = null;

/**
 * Zamienia dowolny kolor z `getComputedStyle` (oklch, color(srgb ...), rgb) na `#rrggbb`.
 * Przeglądarki zwracają dla `var()` na oklch różne zapisy, a canvas zawsze rozumie
 * to, co sama zwróciła, i oddaje sRGB. Rzuca wyjątek, gdy koloru nie da się odczytać.
 */
export function toHex(cssColor: string): string {
  context ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Brak kontekstu 2D canvas: nie da się odczytać koloru');

  context.fillStyle = SENTINEL;
  context.fillStyle = cssColor;
  // Nieprawidłowy kolor canvas ignoruje po cichu i zostaje przy poprzednim.
  if (context.fillStyle === SENTINEL) throw new Error(`Nieznany kolor: "${cssColor}"`);

  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  if (a !== 255) {
    throw new Error(`Kolor półprzezroczysty nie ma jednego kontrastu: "${cssColor}"`);
  }
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}
