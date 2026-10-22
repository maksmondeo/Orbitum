import { Component, computed, input, model } from '@angular/core';
import { hourAt, HourRange } from '../forecast/hour-range';
import { formatHour } from '../forecast/warsaw-time';

/**
 * Suwak godziny prognozy. Natywny `input type="range"`, więc strzałki, Home i End działają
 * bez naszego kodu. Etykieta zmienia się od razu, a o pobieraniu danych decyduje strona.
 */
@Component({
  selector: 'app-hour-slider',
  template: `
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline justify-between gap-2">
        <label for="hour-slider" class="text-sm font-medium">Godzina prognozy</label>
        <output for="hour-slider" class="text-sm font-medium tabular-nums">{{ label() }}</output>
      </div>
      <input
        id="hour-slider"
        type="range"
        min="0"
        step="1"
        class="h-8 w-full accent-primary"
        [max]="range().count - 1"
        [value]="index()"
        [attr.aria-valuetext]="label()"
        (input)="onInput($event)"
      />
      <p class="text-xs text-muted-foreground">Prognoza: od {{ first() }} do {{ last() }}</p>
    </div>
  `,
  host: { class: 'block' },
})
export class HourSlider {
  readonly range = input.required<HourRange>();
  readonly index = model(0);

  protected readonly label = computed(() => formatHour(hourAt(this.range(), this.index())));
  protected readonly first = computed(() => formatHour(this.range().first));
  protected readonly last = computed(() => formatHour(this.range().last));

  protected onInput(event: Event): void {
    this.index.set(Number((event.target as HTMLInputElement).value));
  }
}
