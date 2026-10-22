import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { Variable } from '../forecast/forecast-types';
import { buildRange, PROBE_POINT, startIndex } from '../forecast/hour-range';
import { SCALES } from '../map-render/color-scale';
import { MapCanvas } from './map-canvas';

const HOUR_MS = 3_600_000;

/** Tymczasowo: jedna zmienna. Przełącznik dojdzie w kolejnej fazie. */
const VARIABLE: Variable = 'temperature_2m';

/** Tymczasowa strona: mapa dla jednej godziny wybranej z sondy. Suwak i stany dojdą później. */
@Component({
  imports: [MapCanvas],
  template: `<main class="h-dvh">
    <app-map-canvas [points]="points()" [scale]="scale" />
  </main>`,
})
export default class ForecastMap {
  private readonly api = inject(ForecastApi);

  protected readonly scale = SCALES[VARIABLE];

  protected readonly points = toSignal(
    this.api.singlePointSeries(VARIABLE, PROBE_POINT.lat, PROBE_POINT.lon).pipe(
      map(buildRange),
      filter((range) => range !== null),
      map((range) => {
        const hour = startIndex(range, new Date());
        return new Date(range.first.getTime() + hour * HOUR_MS);
      }),
      switchMap((validTime) => this.api.mapForHour(VARIABLE, validTime)),
      catchError((error: unknown) => {
        console.error('Nie udało się pobrać mapy prognozy', error);
        return of(null);
      }),
    ),
    { initialValue: null },
  );

  constructor() {
    performance.mark('forecast-map-start');
  }
}
