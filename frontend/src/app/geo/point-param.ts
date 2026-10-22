import { isInPoland } from '../map-render/poland-mask';
import { LatLon } from './lat-lon';

const DECIMALS = 4;

/** Punkt z adresu `?lat=&lon=`. Brak parametru, nie liczba albo punkt poza Polską daje `null`. Ta sama reguła co kliknięcie na mapie (`isInPoland`). */
export function parsePoint(params: { get(name: string): string | null }): LatLon | null {
  const rawLat = params.get('lat');
  const rawLon = params.get('lon');
  if (!rawLat || !rawLon) return null;

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  return isInPoland(lon, lat) ? { lat, lon } : null;
}

/** Parametry adresu, które zamykają punkt: `router.navigate` usuwa parametr ustawiony na `null`. */
export const NO_POINT_PARAMS = { lat: null, lon: null } as const;

/** Parametry adresu dla punktu, zaokrąglone do 4 miejsc po przecinku (ok. 11 m). */
export function toQueryParams(point: LatLon): { lat: string; lon: string } {
  return { lat: point.lat.toFixed(DECIMALS), lon: point.lon.toFixed(DECIMALS) };
}
