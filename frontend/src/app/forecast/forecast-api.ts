import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { defer, map, Observable, of, tap } from 'rxjs';
import { API_URL } from '../api/api-url';
import { GridPoint, HourValue, Variable } from './forecast-types';

interface PointResponse {
  values: { valid_time: string; value: number }[];
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/** Jak długo odpowiedź jest ważna. Sprawdzana przy odczycie, bez timerów. */
export const CACHE_TTL_MS = 5 * 60 * 1000;

@Service()
export class ForecastApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly mapCache = new Map<string, CacheEntry<GridPoint[]>>();
  private readonly seriesCache = new Map<string, CacheEntry<HourValue[]>>();

  /** Prognoza w całej siatce dla jednej godziny. Godzina spoza zakresu daje `[]`. */
  mapForHour(variable: Variable, validTime: Date): Observable<GridPoint[]> {
    const valid_time = validTime.toISOString();
    const cacheKey = `${variable}|${valid_time}`

    return this.cached(this.mapCache, cacheKey, () =>
      this.http.get<GridPoint[]>(`${this.apiUrl}/forecast/map`, {
        params: { variable, valid_time },
      }),
    );
  }

  /** Prognoza godzinowa w najbliższym węźle siatki. */
  singlePointSeries(variable: Variable, lat: number, lon: number): Observable<HourValue[]> {
    const params = { variable, lat, lon };
    const cacheKey = `${variable}|${lat}|${lon}`

    return this.cached(this.seriesCache, cacheKey, () =>
      this.http
        .get<PointResponse>(`${this.apiUrl}/forecast`, { params })
        .pipe(
          map((response) =>
            response.values.map((v) => ({ validTime: new Date(v.valid_time), value: v.value })),
          ),
        ),
    );
  }

  /**
   * Świeży wpis z pamięci albo żądanie do sieci. Wpis powstaje dopiero po odpowiedzi (`tap`
   * reaguje na wartość), więc żądanie anulowane przez `unsubscribe` ani błąd HTTP
   * nie zostawiają śladu w cache.
   */
  private cached<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
    request: () => Observable<T>,
  ): Observable<T> {
    return defer(() => {
      const hit = store.get(key);
      if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return of(hit.data);

      return request().pipe(tap((data) => store.set(key, { data, fetchedAt: Date.now() })));
    });
  }
}
