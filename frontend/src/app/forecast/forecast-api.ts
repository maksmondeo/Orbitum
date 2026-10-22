import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from '../api/api-url';
import { CacheEntry, cachedRequest } from '../api/cached-request';
import { GridPoint, HourValue, PointForecast, Variable } from './forecast-types';

interface PointResponse {
  lat: number;
  lon: number;
  values: { valid_time: string; value: number }[];
}

@Service()
export class ForecastApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly mapCache = new Map<string, CacheEntry<GridPoint[]>>();
  private readonly pointCache = new Map<string, CacheEntry<PointForecast>>();

  /** Prognoza w całej siatce dla jednej godziny. Godzina spoza zakresu daje `[]`. */
  mapForHour(variable: Variable, validTime: Date): Observable<GridPoint[]> {
    const valid_time = validTime.toISOString();
    const cacheKey = `${variable}|${valid_time}`

    return cachedRequest(this.mapCache, cacheKey, () =>
      this.http.get<GridPoint[]>(`${this.apiUrl}/forecast/map`, {
        params: { variable, valid_time },
      }),
    );
  }

  /** Prognoza godzinowa w najbliższym węźle siatki, razem ze współrzędnymi tego węzła. */
  pointForecast(variable: Variable, lat: number, lon: number): Observable<PointForecast> {
    const params = { variable, lat, lon };
    const cacheKey = `${variable}|${lat}|${lon}`

    return cachedRequest(this.pointCache, cacheKey, () =>
      this.http.get<PointResponse>(`${this.apiUrl}/forecast`, { params }).pipe(
        map((response) => ({
          lat: response.lat,
          lon: response.lon,
          values: response.values.map((v) => ({ validTime: new Date(v.valid_time), value: v.value })),
        })),
      ),
    );
  }

  /** Same godziny z `pointForecast`; dzieli z nim cache i żądanie. */
  singlePointSeries(variable: Variable, lat: number, lon: number): Observable<HourValue[]> {
    return this.pointForecast(variable, lat, lon).pipe(map((point) => point.values));
  }
}
