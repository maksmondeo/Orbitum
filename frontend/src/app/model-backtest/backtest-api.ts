import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from '../api/api-url';
import { CacheEntry, cachedRequest } from '../api/cached-request';
import { Variable } from '../forecast/forecast-types';

/** Jeden przedział horyzontu (6 godzin od wydania prognozy) z wyników backtestu. */
export interface BacktestBucket {
  fromHour: number;
  toHour: number;
  /** Model, który backend uznał za najlepszy w przedziale (pomija modele z za małym pokryciem). */
  best: string;
  /** RMSE modeli. Model bez liczby w przedziale nie ma klucza. */
  rmse: Record<string, number>;
}

/** Odpowiedź `/models`: węzeł siatki i przedziały horyzontu. */
export interface PointBacktest {
  lat: number;
  lon: number;
  buckets: BacktestBucket[];
}

interface ModelsResponse {
  lat: number;
  lon: number;
  buckets: { lead_h: string; best: string; rmse: Record<string, number> }[];
}

/** „1-6” → `{ fromHour: 1, toHour: 6 }`. */
function parseLead(leadH: string): { fromHour: number; toHour: number } {
  const [from, to] = leadH.split('-').map(Number);
  return { fromHour: from, toHour: to };
}

@Service()
export class BacktestApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly cache = new Map<string, CacheEntry<PointBacktest>>();

  /** Jak modele wypadły w backteście w najbliższym węźle siatki. */
  modelRanking(variable: Variable, lat: number, lon: number): Observable<PointBacktest> {
    const params = { variable, lat, lon };
    const cacheKey = `${variable}|${lat}|${lon}`;

    return cachedRequest(this.cache, cacheKey, () =>
      this.http.get<ModelsResponse>(`${this.apiUrl}/models`, { params }).pipe(
        map((response) => ({
          lat: response.lat,
          lon: response.lon,
          buckets: response.buckets.map((b) => ({
            ...parseLead(b.lead_h),
            best: b.best,
            rmse: b.rmse,
          })),
        })),
      ),
    );
  }
}
