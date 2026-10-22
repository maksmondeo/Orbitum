import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_URL } from '../../api/api-url';
import { GridPoint, HourValue, Variable } from '../forecast-types';

interface PointResponse {
  values: { valid_time: string; value: number }[];
}

@Service()
export class ForecastApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  /** Prognoza w całej siatce dla jednej godziny. Godzina spoza zakresu daje `[]`. */
  mapForHour(variable: Variable, validTime: Date): Observable<GridPoint[]> {
    const valid_time = validTime.toISOString()
    
    return this.http.get<GridPoint[]>(`${this.apiUrl}/forecast/map`, {
      params: { variable, valid_time },
    });
  }

  /** Prognoza godzinowa w najbliższym węźle siatki. */
  singlePointSeries(variable: Variable, lat: number, lon: number): Observable<HourValue[]> {
    const params = { variable, lat, lon }

    return this.http
      .get<PointResponse>(`${this.apiUrl}/forecast`, { params })
      .pipe(
        map((response) =>
          response.values.map((v) => ({ validTime: new Date(v.valid_time), value: v.value })),
        ),
      );
  }
}
