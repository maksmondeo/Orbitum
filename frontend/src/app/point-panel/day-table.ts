import { Component, input, signal } from '@angular/core';
import { Variable } from '../forecast/forecast-types';
import { formatClock, formatDay } from '../forecast/warsaw-time';
import { SCALES } from '../map-render/color-scale';
import { DaySummary } from './daily-summary';

const NUMBERS: Record<Variable, Intl.NumberFormat> = {
  temperature_2m: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pressure_msl: new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }),
};

/** Wartość z jednostką, np. „−0,4 °C” (prawdziwy minus, nie łącznik) albo „1013 hPa”. */
function formatValue(value: number, variable: Variable): string {
  return `${NUMBERS[variable].format(value).replace('-', '−')} ${SCALES[variable].unit}`;
}

/** Opis dnia niepełnego, np. „od 22:00” albo „od 06:00 do 20:00”; dla pełnego dnia pusty. */
function partialNote(day: DaySummary): string {
  const from = day.startsLate ? `od ${formatClock(day.first)}` : '';
  const to = day.endsEarly ? `do ${formatClock(day.last)}` : '';
  return [from, to].filter(Boolean).join(' ');
}

/** Tabela dni z min i max; godziny danego dnia rozwija przycisk w pierwszej komórce wiersza. */
@Component({
  selector: 'app-day-table',
  template: `
    <table class="w-full text-sm">
      <caption class="sr-only">
        Prognoza dzienna: najniższa i najwyższa wartość w każdym dniu
      </caption>
      <thead>
        <tr class="text-left text-muted-foreground">
          <th scope="col" class="py-2 pr-2 font-medium">Dzień</th>
          <th scope="col" class="px-2 py-2 text-right font-medium">Min</th>
          <th scope="col" class="py-2 pl-2 text-right font-medium">Max</th>
        </tr>
      </thead>
      @for (day of days(); track day.key) {
        <tbody class="border-t">
          <tr>
            <th scope="row" class="py-1 pr-2 text-left font-normal">
              <button
                type="button"
                class="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                [attr.aria-expanded]="isOpen(day.key)"
                (click)="toggle(day.key)"
              >
                <svg
                  class="size-4 shrink-0"
                  [class.rotate-90]="isOpen(day.key)"
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
                <span>
                  {{ formatDay(day.first) }}
                  @if (note(day); as note) {
                    <span class="block text-xs text-muted-foreground">{{ note }}</span>
                  }
                </span>
              </button>
            </th>
            <td class="px-2 py-1 text-right tabular-nums">{{ value(day.min) }}</td>
            <td class="py-1 pl-2 text-right tabular-nums">{{ value(day.max) }}</td>
          </tr>
          @if (isOpen(day.key)) {
            @for (hour of day.hours; track hour.validTime.getTime()) {
              <tr class="text-muted-foreground">
                <th scope="row" class="py-1 pl-6 text-left font-normal">{{ formatClock(hour.validTime) }}</th>
                <td colspan="2" class="py-1 pl-2 text-right tabular-nums">{{ value(hour.value) }}</td>
              </tr>
            }
          }
        </tbody>
      }
    </table>
  `,
  host: { class: 'block' },
})
export class DayTable {
  readonly days = input.required<DaySummary[]>();
  readonly variable = input.required<Variable>();

  /** Klucze dni, które użytkownik rozwinął. Wszystkie dni startują zwinięte. */
  private readonly open = signal<ReadonlySet<string>>(new Set());

  protected readonly formatDay = formatDay;
  protected readonly formatClock = formatClock;
  protected readonly note = partialNote;

  protected isOpen(key: string): boolean {
    return this.open().has(key);
  }

  protected toggle(key: string): void {
    this.open.update((open) => {
      const next = new Set(open);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected value(value: number): string {
    return formatValue(value, this.variable());
  }
}
