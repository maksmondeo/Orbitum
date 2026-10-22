import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { PointForecast, Variable } from '../forecast/forecast-types';
import { distanceKm } from '../geo/geo-distance';
import { LatLon } from '../geo/lat-lon';
import { VariableSwitch } from '../variable-switch/variable-switch';
import { summarizeDays } from './daily-summary';
import { DayTable } from './day-table';

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
  empty: { text: 'Brak prognozy dla tego punktu.', classes: 'bg-info text-info-foreground' },
  expired: {
    text: 'Prognoza wygasła. Odśwież stronę, żeby pobrać aktualną.',
    classes: 'bg-warning text-warning-foreground',
  },
};

/** O co pytamy backend. Każda zmiana któregokolwiek pola (także numeru próby) to nowe żądanie. */
interface Request {
  point: LatLon;
  variable: Variable;
  attempt: number;
}

/** Odpowiedź razem z pytaniem, na które przyszła. `forecast: null` to błąd. */
interface Result {
  request: Request;
  forecast: PointForecast | null;
}

const decimals = (digits: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const GRID_NUMBER = decimals(2);
const CLICK_NUMBER = decimals(4);
const KM_NUMBER = decimals(1);

/** Szerokość i długość z polskim przecinkiem, np. „51,25° N 22,50° E”. */
function formatCoords(point: LatLon, format: Intl.NumberFormat): string {
  return `${format.format(point.lat)}° N ${format.format(point.lon)}° E`;
}

/** Panel prognozy w jednym punkcie: węzeł siatki, odległość od wskazanego miejsca i stany pobierania. */
@Component({
  selector: 'app-point-panel',
  imports: [VariableSwitch, DayTable],
  template: `
    <aside class="flex flex-col gap-4 p-4" aria-label="Prognoza w wybranym punkcie">
      <header class="flex items-start justify-between gap-3">
        <div>
          <h2
            #heading
            tabindex="-1"
            class="text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >{{ title() }}</h2>
          @if (distance(); as distance) {
            <p class="text-sm text-muted-foreground">{{ distance }}</p>
          }
        </div>
        <button
          type="button"
          class="-m-1 flex size-9 cursor-pointer shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Zamknij panel"
          (click)="closed.emit()"
        >
          <svg
            class="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <app-variable-switch name="panel-variable" [(value)]="variable" />

      @if (message(); as message) {
        <div
          class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-sm"
          [class]="message.classes"
          [attr.role]="status() === 'error' ? 'alert' : 'status'"
        >
          <svg
            class="size-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            @switch (status()) {
              @case ('loading') {
                <path class="origin-center animate-spin motion-reduce:animate-none" d="M12 3a9 9 0 1 0 9 9" />
              }
              @case ('error') {
                <circle cx="12" cy="12" r="10" />
                <path d="M12 7v6M12 16.5h.01" />
              }
              @case ('expired') {
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4M12 17h.01" />
              }
              @default {
                <circle cx="12" cy="12" r="10" />
                <path d="M12 11v6M12 7.5h.01" />
              }
            }
          </svg>
          <p class="flex-1">{{ message.text }}</p>
          @if (status() === 'error') {
            <button
              type="button"
              class="cursor-pointer rounded-md border border-current px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              (click)="retry()"
            >
              Spróbuj ponownie
            </button>
          }
        </div>
      }

      @if (days().length > 0) {
        <app-day-table [days]="days()" [variable]="variable()" />
      }
      <!-- Tu dojdzie sekcja z wynikami modeli (S-03). -->
    </aside>
  `,
  host: { class: 'block', '(keydown.escape)': 'closed.emit()' },
})
export class PointPanel {
  private readonly api = inject(ForecastApi);

  /** Kliknięte miejsce (z adresu). */
  readonly point = input.required<LatLon>();
  /** „Teraz” do odcinania godzin z przeszłości. Brak wartości = zegar przeglądarki; testy ustawiają własne. */
  readonly now = input<Date>();

  /** Zmienna z mapy w chwili otwarcia panelu. Późniejsze zmiany na pasku mapy panelu nie ruszają. */
  readonly initialVariable = input.required<Variable>();

  readonly closed = output<void>();
  /** Węzeł siatki, który backend przypisał do klikniętego miejsca; strona rysuje go na mapie. */
  readonly nodeResolved = output<LatLon>();

  /** Startuje od zmiennej z mapy, potem żyje własnym życiem: późniejsze wartości wejścia są ignorowane. */
  protected readonly variable = linkedSignal<Variable, Variable>({
    source: this.initialVariable,
    computation: (initial, previous) => previous?.value ?? initial,
  });

  /** „Spróbuj ponownie” zwiększa numer, co jest nowym pytaniem, więc panel wraca do ładowania. */
  private readonly attempt = signal(0);

  private readonly request = computed<Request>(
    () => ({ point: this.point(), variable: this.variable(), attempt: this.attempt() }),
    {
      equal: (a, b) =>
        a.point.lat === b.point.lat &&
        a.point.lon === b.point.lon &&
        a.variable === b.variable &&
        a.attempt === b.attempt,
    },
  );

  private readonly latestResult = toSignal(
    toObservable(this.request).pipe(
      // Nowe pytanie anuluje poprzednie, więc spóźniona odpowiedź nie nadpisze nowszej.
      switchMap((request) =>
        this.api.pointForecast(request.variable, request.point.lat, request.point.lon).pipe(
          map((forecast): Result => ({ request, forecast })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać prognozy punktu', error);
            return of<Result>({ request, forecast: null });
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  /** Ostatnia odpowiedź, ale tylko na to, o co pytamy teraz (`request` zwraca ten sam obiekt, gdy nic się nie zmieniło). */
  private readonly result = computed(() => {
    const latest = this.latestResult();
    return latest?.request === this.request() ? latest : null;
  });

  private readonly forecast = computed(() => this.result()?.forecast ?? null);

  /** Dni z min i max, bez godzin, które już minęły. Puste, gdy brak prognozy albo wygasła. */
  protected readonly days = computed(() => {
    const forecast = this.forecast();
    return forecast ? summarizeDays(forecast.values, this.now() ?? new Date()) : [];
  });

  protected readonly status = computed<Status>(() => {
    const result = this.result();
    if (!result) return 'loading';
    if (!result.forecast) return 'error';
    if (result.forecast.values.length === 0) return 'empty';
    return this.days().length === 0 ? 'expired' : 'ready';
  });

  protected readonly message = computed(() => {
    const status = this.status();
    return status === 'ready' ? null : MESSAGES[status];
  });

  protected readonly title = computed(() => {
    const forecast = this.forecast();
    return forecast
      ? `Punkt siatki ${formatCoords(forecast, GRID_NUMBER)}`
      : `Wskazane miejsce ${formatCoords(this.point(), CLICK_NUMBER)}`;
  });

  protected readonly distance = computed(() => {
    const forecast = this.forecast();
    if (!forecast) return null;
    return `${KM_NUMBER.format(distanceKm(this.point(), forecast))} km od wskazanego miejsca`;
  });

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  constructor() {
    // Fokus na nagłówek przy otwarciu i przy każdym nowym punkcie: czytnik zaczyna od panelu,
    // a Esc działa od razu, bo fokus jest w panelu, a nie na płótnie mapy.
    afterRenderEffect(() => {
      this.point();
      this.heading().nativeElement.focus({ preventScroll: true });
    });

    effect(() => {
      const forecast = this.forecast();
      if (forecast) this.nodeResolved.emit({ lat: forecast.lat, lon: forecast.lon });
    });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
