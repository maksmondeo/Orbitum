/** Zamknięty kontur jako lista wierzchołków [długość, szerokość]. Ostatni wierzchołek łączy się z pierwszym. */
export type Ring = [number, number][];

/**
 * Czy punkt leży wewnątrz konturu (metoda promienia): z punktu prowadzimy poziomą półprostą
 * w prawo i liczymy, ile krawędzi konturu przecina. Nieparzysta liczba przecięć oznacza środek.
 * Działa też dla wielokątów wklęsłych.
 */
export function isInside(point: [number, number], ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Krawędź przecina wysokość punktu (jeden koniec nad, drugi pod) i to na prawo od niego.
    const crossesHeight = yi > y !== yj > y;
    if (crossesHeight && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}
