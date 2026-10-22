import { Component, computed, input } from '@angular/core';
import { Variable } from '../forecast/forecast-types';
import { SCALES } from '../map-render/color-scale';
import { BacktestBucket } from './backtest-api';

const RMSE = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Tabela błędów RMSE: wiersz na przedział horyzontu, kolumna na model. Nic nie pobiera. */
@Component({
  selector: 'app-rmse-table',
  template: `
    <div
      role="region"
      tabindex="0"
      aria-label="Błędy modeli w przedziałach horyzontu, tabela przewijana w bok"
      class="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <table class="w-full border-separate border-spacing-0 text-sm">
        <caption class="sr-only">
          {{ caption() }}
        </caption>
        <thead>
          <tr class="text-left text-muted-foreground">
            <th scope="col" class="sticky left-0 border-b bg-background py-2 pr-3 pl-2 font-medium">
              Horyzont
            </th>
            @for (model of models(); track model) {
              <th scope="col" class="border-b px-3 py-2 text-right font-medium whitespace-nowrap">
                {{ model }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (bucket of buckets(); track bucket.fromHour) {
            <tr>
              <th
                scope="row"
                class="sticky left-0 border-b bg-background py-1 pr-3 pl-2 text-left font-normal whitespace-nowrap"
              >
                {{ bucket.fromHour }}–{{ bucket.toHour }} h
              </th>
              @for (model of models(); track model) {
                <td class="border-b px-3 py-1 text-right whitespace-nowrap tabular-nums">
                  @let rmse = rmseOf(bucket, model);
                  @if (rmse !== undefined) {
                    {{ format(rmse) }}
                    @if (model === bucket.best) {
                      <span aria-hidden="true">▲</span>
                      <span class="sr-only">najmniejszy błąd</span>
                    }
                  } @else {
                    <span aria-hidden="true">—</span>
                    <span class="sr-only">brak danych</span>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  host: { class: 'block' },
})
export class RmseTable {
  readonly buckets = input.required<BacktestBucket[]>();
  readonly models = input.required<string[]>();
  readonly variable = input.required<Variable>();

  protected readonly caption = computed(
    () => `Błędy modeli (RMSE, ${SCALES[this.variable()].unit}) w przedziałach horyzontu prognozy`,
  );

  protected rmseOf(bucket: BacktestBucket, model: string): number | undefined {
    return bucket.rmse[model];
  }

  protected format(rmse: number): string {
    return RMSE.format(rmse);
  }
}
