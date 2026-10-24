import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { Variable } from '../forecast/forecast-types';
import { LatLon } from '../geo/lat-lon';
import { SCALES } from '../map-render/color-scale';
import { BacktestApi, PointBacktest } from './backtest-api';
import { orderModels, summarizeWinners } from './backtest-summary';
import { RmseTable } from './rmse-table';

type Status = 'loading' | 'error' | 'empty' | 'ready';

/**
 * Teksty i kolory komunikatów. Kolory tylko z tokenów stanu; ikona i tekst niosą znaczenie
 * razem z barwą (NFR-09). Użytkownik nie dostaje surowej odpowiedzi serwera.
 */
const MESSAGES: Record<Exclude<Status, 'ready'>, { text: string; classes: string }> = {
  loading: { text: 'Ładuję wyniki modeli…', classes: 'bg-info text-info-foreground' },
  error: {
    text: 'Nie udało się pobrać wyników modeli. Sprawdź połączenie i spróbuj ponownie.',
    classes: 'bg-destructive text-destructive-foreground',
  },
  empty: { text: 'Brak wyników modeli dla tego punktu.', classes: 'bg-info text-info-foreground' },
};

/** O co pytamy backend. Każda zmiana któregokolwiek pola (także numeru próby) to nowe żądanie. */
interface Request {
  point: LatLon;
  variable: Variable;
  attempt: number;
}

/** Odpowiedź razem z pytaniem, na które przyszła. `ranking: null` to błąd. */
interface Result {
  request: Request;
  ranking: PointBacktest | null;
}

/** Sekcja panelu: jak modele wypadły w backteście w tym punkcie. Sama pobiera dane i pokazuje stany. */
@Component({
  selector: 'app-model-backtest',
  imports: [RmseTable],
  template: `
    <section class="flex flex-col gap-3 border-t pt-4" aria-labelledby="model-backtest-heading">
      <h3 id="model-backtest-heading" class="text-base font-semibold">Jak modele wypadły w tym punkcie</h3>
      <p class="text-sm text-muted-foreground">
        Prognoza wyżej to mieszanka modeli. Więcej waży ten, który mylił się tu mniej w teście na danych
        historycznych.
      </p>

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

      @if (status() === 'ready') {
        <div class="text-sm">
          <p class="font-medium">Najmniej mylił się:</p>
          <ul class="mt-1 flex flex-col gap-0.5">
            @for (line of winners(); track line.fromHour) {
              <li>
                <span class="tabular-nums">{{ line.fromHour }}–{{ line.toHour }} h naprzód:</span>
                {{ line.model }}
              </li>
            }
          </ul>
        </div>

        <button
          type="button"
          class="-mx-1 flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-controls="model-backtest-table"
          [attr.aria-expanded]="expanded()"
          (click)="toggle()"
        >
          <svg
            class="size-4 shrink-0"
            [class.rotate-90]="expanded()"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          Błędy wszystkich modeli (RMSE, {{ unit() }})
        </button>

        <div id="model-backtest-table">
          @if (expanded()) {
            <app-rmse-table [buckets]="buckets()" [models]="models()" [variable]="variable()" />
            <p class="mt-2 text-xs text-muted-foreground">
              ▲ oznacza model, który backend uznał za najlepszy w przedziale; modele z za małą liczbą
              porównań są pomijane, więc ▲ nie zawsze stoi przy najmniejszej liczbie.
            </p>
          }
        </div>
      }
    </section>
  `,
  host: { class: 'block' },
})
export class ModelBacktest {
  private readonly api = inject(BacktestApi);

  /** Kliknięte miejsce; backend sam przyciąga je do węzła siatki. */
  readonly point = input.required<LatLon>();
  readonly variable = input.required<Variable>();

  /** Czy tabela jest rozwinięta. Przeżywa zmianę zmiennej i punktu: gość nie rozwija jej drugi raz. */
  protected readonly expanded = signal(false);

  /** „Spróbuj ponownie” zwiększa numer, co jest nowym pytaniem, więc sekcja wraca do ładowania. */
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
        this.api.modelRanking(request.variable, request.point.lat, request.point.lon).pipe(
          map((ranking): Result => ({ request, ranking })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać wyników modeli', error);
            return of<Result>({ request, ranking: null });
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

  protected readonly buckets = computed(() => this.result()?.ranking?.buckets ?? []);
  protected readonly winners = computed(() => summarizeWinners(this.buckets()));
  protected readonly models = computed(() => orderModels(this.buckets()));
  protected readonly unit = computed(() => SCALES[this.variable()].unit);

  protected readonly status = computed<Status>(() => {
    const result = this.result();
    if (!result) return 'loading';
    if (!result.ranking) return 'error';
    return result.ranking.buckets.length === 0 ? 'empty' : 'ready';
  });

  protected readonly message = computed(() => {
    const status = this.status();
    return status === 'ready' ? null : MESSAGES[status];
  });

  protected toggle(): void {
    this.expanded.update((open) => !open);
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
