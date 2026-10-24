import { Component, computed, effect, ElementRef, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { asyncScheduler, catchError, filter, map, of, switchMap, throttleTime } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { GridPoint, Variable } from '../forecast/forecast-types';
import {
  buildRange,
  hourAt,
  HourRange,
  isExpired,
  PROBE_POINT,
  startIndex,
} from '../forecast/hour-range';
import { LatLon } from '../geo/lat-lon';
import { NO_POINT_PARAMS, parsePoint, toQueryParams } from '../geo/point-param';
import { SCALES } from '../map-render/color-scale';
import { PointPanel } from '../point-panel/point-panel';
import { VariableSwitch } from '../variable-switch/variable-switch';
import { HourSlider } from './hour-slider';
import { MapCanvas, PointSelection } from './map-canvas';
import { MapLegend } from './map-legend';

/** Najwyżej jedno żądanie o mapę w tym oknie (patrz `throttleTime` niżej). */
const THROTTLE_MS = 300;

/** Co strona pokazuje w komunikacie nad mapą. `ready` oznacza brak komunikatu. */
type Status = 'loading' | 'error' | 'empty' | 'expired' | 'ready';

/**
 * Teksty i kolory komunikatów. Kolory tylko z tokenów stanu; ikona i tekst niosą znaczenie
 * razem z barwą (NFR-09). Użytkownik nie dostaje surowej odpowiedzi serwera.
 */
const MESSAGES: Record<Exclude<Status, 'ready'>, { text: string; classes: string }> = {
  loading: { text: 'Ładuję prognozę…', classes: 'bg-info text-info-foreground' },
  error: {
    text: 'Nie udało się pobrać prognozy. Sprawdź połączenie i spróbuj ponownie.',
    classes: 'bg-destructive text-destructive-foreground',
  },
  empty: { text: 'Brak prognozy do wyświetlenia.', classes: 'bg-info text-info-foreground' },
  expired: {
    text: 'Prognoza wygasła. Pokazuję jej ostatnią godzinę.',
    classes: 'bg-warning text-warning-foreground',
  },
};

/** Wynik sondy. `failed` to błąd sieci lub serwera, a `range: null` to sondą potwierdzony brak prognozy. */
interface ProbeResult {
  attempt: number;
  range: HourRange | null;
  failed: boolean;
}

/** Wynik pobrania mapy jednej godziny. `points: null` to błąd, a `[]` to brak prognozy na tę godzinę. */
interface MapResult {
  variable: Variable;
  attempt: number;
  points: GridPoint[] | null;
}

@Component({
  imports: [MapCanvas, HourSlider, MapLegend, PointPanel, VariableSwitch],
  // Host komponentu jest domyślnie `inline`, a `h-full` z szablonu działa tylko na elemencie blokowym.
  host: { class: 'block h-full' },
  templateUrl: './forecast-map.html',
})
export default class ForecastMap {
  private readonly api = inject(ForecastApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly variable = signal<Variable>('temperature_2m');
  protected readonly scale = computed(() => SCALES[this.variable()]);

  /**
   * Numer próby. „Spróbuj ponownie” zwiększa go, a wyniki z wcześniejszej próby przestają się
   * liczyć, więc strona od razu wraca do stanu ładowania zamiast dalej pokazywać stary błąd.
   */
  private readonly attempt = signal(0);

  /** Wynik sondy (jeden punkt siatki), osobno dla każdej zmiennej. `null`, dopóki nic nie przyszło. */
  private readonly probeResult = toSignal(
    toObservable(computed(() => ({ variable: this.variable(), attempt: this.attempt() }))).pipe(
      switchMap(({ variable, attempt }) =>
        this.api.singlePointSeries(variable, PROBE_POINT.lat, PROBE_POINT.lon).pipe(
          map((series): ProbeResult => ({ attempt, range: buildRange(series), failed: false })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać zakresu godzin', error);
            return of<ProbeResult>({ attempt, range: null, failed: true });
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  /**
   * Zakres godzin w bazie. Błąd zostawia poprzedni zakres (suwak nie znika), a pusta seria
   * ustawia `null`: to jest „brak prognozy”.
   */
  protected readonly range = linkedSignal<ProbeResult | null, HourRange | null>({
    source: this.probeResult,
    computation: (result, previous) =>
      result?.failed ? (previous?.value ?? null) : (result?.range ?? null),
  });

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

  /** Co użytkownik wybrał do pokazania na mapie. Równy wybór (ta sama zmienna, godzina i próba) nie budzi strumienia. */
  private readonly selection = computed(
    () => {
      const range = this.range();
      if (!range) return null;
      return {
        variable: this.variable(),
        validTime: hourAt(range, this.sliderIndex()),
        attempt: this.attempt(),
      };
    },
    {
      equal: (a, b) =>
        a?.variable === b?.variable &&
        a?.attempt === b?.attempt &&
        a?.validTime.getTime() === b?.validTime.getTime(),
    },
  );

  /**
   * Ostatni wynik pobrania mapy, razem ze zmienną, której dotyczy. Podczas przesuwania suwaka poprzedni
   * raster zostaje na mapie, a po zmianie zmiennej znika, żeby nie dostał obcej skali.
   */
  private readonly latestMapResult = toSignal(
    toObservable(this.selection).pipe(
      filter((selection) => selection !== null),
      // leading: pierwsze żądanie idzie od razu. trailing: ostatnia pozycja suwaka zawsze
      // zostaje pobrana, nawet jeśli wpadła w okno blokady.
      throttleTime(THROTTLE_MS, asyncScheduler, { leading: true, trailing: true }),
      // Nowe żądanie anuluje poprzednie, więc spóźniona odpowiedź nie nadpisze nowszej.
      switchMap(({ variable, validTime, attempt }) =>
        this.api.mapForHour(variable, validTime).pipe(
          map((points): MapResult => ({ variable, attempt, points })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać mapy prognozy', error);
            return of<MapResult>({ variable, attempt, points: null });
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  /** Ostatni wynik, ale tylko jeśli pasuje do tego, co użytkownik ma teraz wybrane (zmienna i próba). */
  private readonly currentMapResult = computed(() => {
    const loaded = this.latestMapResult();
    const isCurrent = loaded?.variable === this.variable() && loaded.attempt === this.attempt();
    return isCurrent ? loaded : null;
  });

  protected readonly points = computed(() => this.currentMapResult()?.points ?? null);

  /** Kolejność ma znaczenie: błąd przesłania „brak prognozy”, a ten „wygasłą”. */
  protected readonly status = computed<Status>(() => {
    const result = this.probeResult();
    if (!result || result.attempt !== this.attempt()) return 'loading';
    if (result.failed) return 'error';

    const range = this.range();
    if (!range) return 'empty';

    const mapResult = this.currentMapResult();
    if (!mapResult) return 'loading';
    if (!mapResult.points) return 'error';
    if (mapResult.points.length === 0) return 'empty';

    return isExpired(range, new Date()) ? 'expired' : 'ready';
  });

  protected readonly message = computed(() => {
    const status = this.status();
    return status === 'ready' ? null : MESSAGES[status];
  });

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  /** Wybrany punkt. Źródłem prawdy jest adres, więc odświeżenie i Wstecz działają bez naszego kodu. */
  protected readonly point = computed(() => parsePoint(this.queryParams()), {
    equal: (a, b) => a?.lat === b?.lat && a?.lon === b?.lon,
  });

  /** Węzeł siatki dla wybranego punktu. Panel podaje go po odpowiedzi; nowy punkt czyści stary węzeł. */
  protected readonly node = linkedSignal<LatLon | null, LatLon | null>({
    source: this.point,
    computation: () => null,
  });

  protected readonly pointSelection = computed<PointSelection | null>(() => {
    const click = this.point();
    return click && { click, node: this.node() };
  });

  /** Panel z szablonu (jest tylko przy wybranym punkcie). */
  private readonly panel = viewChild(PointPanel, { read: ElementRef });

  /**
   * Ile pikseli od dołu mapy zasłania szuflada z panelem; 0, gdy panelu nie ma albo stoi obok mapy.
   * Szuflada to panel z `position: fixed`, więc wysokość mierzymy tylko w tym trybie. Dzięki temu strona
   * nie zna progu `md` ani wysokości szuflady, a pomiar nadąża za treścią (ładowanie, rozwinięte dni).
   */
  protected readonly bottomInset = signal(0);

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  /** Klik to zwykła nawigacja (z wpisem w historii), więc Wstecz zamyka panel. */
  protected selectPoint(point: LatLon): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(point) });
  }

  protected closePanel(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: NO_POINT_PARAMS });
  }

  constructor() {
    performance.mark('forecast-map-start');

    effect((onCleanup) => {
      const panel: HTMLElement | undefined = this.panel()?.nativeElement;
      if (!panel) {
        this.bottomInset.set(0);
        return;
      }
      const observer = new ResizeObserver(() =>
        this.bottomInset.set(getComputedStyle(panel).position === 'fixed' ? panel.offsetHeight : 0),
      );
      observer.observe(panel);
      onCleanup(() => observer.disconnect());
    });
  }
}
