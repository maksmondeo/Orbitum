import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { asyncScheduler, catchError, filter, map, of, switchMap, throttleTime } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { Variable } from '../forecast/forecast-types';
import { buildRange, hourAt, HourRange, PROBE_POINT, startIndex } from '../forecast/hour-range';
import { SCALES } from '../map-render/color-scale';
import { HourSlider } from './hour-slider';
import { MapCanvas } from './map-canvas';
import { MapLegend } from './map-legend';

/** Najwyżej jedno żądanie o mapę w tym oknie (patrz `throttleTime` niżej). */
const THROTTLE_MS = 300;

const VARIABLES = Object.keys(SCALES) as Variable[];

@Component({
  imports: [MapCanvas, HourSlider, MapLegend],
  templateUrl: './forecast-map.html',
})
export default class ForecastMap {
  private readonly api = inject(ForecastApi);

  protected readonly variables = VARIABLES;
  protected readonly scales = SCALES;
  protected readonly variable = signal<Variable>('temperature_2m');
  protected readonly scale = computed(() => SCALES[this.variable()]);

  /** Zakres godzin w bazie. Pytamy o niego sondę (jeden punkt siatki), osobno dla każdej zmiennej. */
  protected readonly range = toSignal(
    toObservable(this.variable).pipe(
      switchMap((variable) =>
        this.api.singlePointSeries(variable, PROBE_POINT.lat, PROBE_POINT.lon).pipe(
          map(buildRange),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać zakresu godzin', error);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  /**
   * Pozycja suwaka. Przy pierwszym zakresie startuje na „teraz”, a przy kolejnych (np. po zmianie
   * zmiennej) zostaje tam, gdzie była, więc użytkownik nie traci wybranej godziny.
   */
  protected readonly sliderIndex = linkedSignal<HourRange | null, number>({
    source: this.range,
    computation: (range, previous) => {
      if (!range) return previous?.value ?? 0;
      if (!previous?.source) return startIndex(range, new Date());
      return Math.min(previous.value, range.count - 1);
    },
  });

  /** Co chcemy mieć na mapie. Równe żądania (ta sama zmienna i godzina) nie budzą strumienia. */
  private readonly request = computed(
    () => {
      const range = this.range();
      if (!range) return null;
      return { variable: this.variable(), validTime: hourAt(range, this.sliderIndex()) };
    },
    {
      equal: (a, b) =>
        a?.variable === b?.variable && a?.validTime.getTime() === b?.validTime.getTime(),
    },
  );

  /**
   * Dane ostatniej odpowiedzi razem ze zmienną, której dotyczą. Podczas przesuwania suwaka
   * poprzedni raster zostaje na mapie, a po zmianie zmiennej znika, żeby nie dostał obcej skali.
   */
  private readonly lastLoadedResponse = toSignal(
    toObservable(this.request).pipe(
      filter((request) => request !== null),
      // leading: pierwsze żądanie idzie od razu. trailing: ostatnia pozycja suwaka zawsze
      // zostaje pobrana, nawet jeśli wpadła w okno blokady.
      throttleTime(THROTTLE_MS, asyncScheduler, { leading: true, trailing: true }),
      // Nowe żądanie anuluje poprzednie, więc spóźniona odpowiedź nie nadpisze nowszej.
      switchMap(({ variable, validTime }) =>
        this.api.mapForHour(variable, validTime).pipe(
          map((points) => ({ variable, points })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać mapy prognozy', error);
            return of({ variable, points: null });
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly points = computed(() => {
    const loaded = this.lastLoadedResponse();
    return loaded?.variable === this.variable() ? loaded.points : null;
  });

  constructor() {
    performance.mark('forecast-map-start');
  }
}
