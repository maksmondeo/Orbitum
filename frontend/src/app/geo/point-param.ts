import { LatLon } from './lat-lon';

/**
 * Prostokąt siatki backendu (`LAT`, `LON` w `backend/app/config.py`: 49–55° N, 14–24,25° E)
 * powiększony o pół komórki (0,125°), czyli do krawędzi skrajnych komórek.
 */
const GRID_BOUNDS = { latMin: 48.875, latMax: 55.125, lonMin: 13.875, lonMax: 24.375 };

const DECIMALS = 4;

/** Punkt z adresu `?lat=&lon=`. Brak parametru, nie liczba albo punkt poza siatką daje `null`. */
export function parsePoint(params: { get(name: string): string | null }): LatLon | null {
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  if (!rawLat || !rawLon) return null;

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  const inside =
    lat >= GRID_BOUNDS.latMin &&
    lat <= GRID_BOUNDS.latMax &&
    lon >= GRID_BOUNDS.lonMin &&
    lon <= GRID_BOUNDS.lonMax;

  return inside ? { lat, lon } : null;
}

/** Parametry adresu dla punktu, zaokrąglone do 4 miejsc po przecinku (ok. 11 m). */
export function toQueryParams(point: LatLon): { lat: string; lon: string } {
  return { lat: point.lat.toFixed(DECIMALS), lon: point.lon.toFixed(DECIMALS) };
}
