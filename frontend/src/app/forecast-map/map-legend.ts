import { Component, computed, input } from '@angular/core';
import { ColorScale } from '../map-render/color-scale';

/** Najmniejszy odstęp między podpisami na pasku (w % szerokości), żeby liczby na siebie nie nachodziły. */
const MIN_LABEL_GAP = 15;

/**
 * Legenda: pasek gradientu z tych samych stopni co raster, plus liczby i jednostka.
 * Kolor nigdy nie jest jedyną informacją (NFR-09), dlatego wartości są też zapisane tekstem.
 */
@Component({
  selector: 'app-map-legend',
  template: `
    <div class="flex flex-col gap-1">
      <p class="text-sm font-medium">{{ scale().label }}, {{ scale().unit }}</p>
      <div class="px-3">
        <div class="h-3 rounded-sm border" [style.background]="gradient()"></div>
        <div class="relative h-5 text-xs text-muted-foreground tabular-nums">
          @for (tick of ticks(); track tick.value) {
            <span class="absolute -translate-x-1/2" [style.left.%]="tick.position">
              {{ tick.value }}
            </span>
          }
        </div>
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class MapLegend {
  readonly scale = input.required<ColorScale>();

  /** Stopnie skali z pozycją na pasku w % (0 = najniższa wartość, 100 = najwyższa). */
  private readonly positioned = computed(() => {
    const { stops } = this.scale();
    const min = stops[0].value;
    const span = stops[stops.length - 1].value - min;
    return stops.map((stop) => ({ ...stop, position: ((stop.value - min) / span) * 100 }));
  });

  protected readonly gradient = computed(() => {
    const parts = this.positioned().map(
      ({ color: [r, g, b], position }) => `rgb(${r} ${g} ${b}) ${position}%`,
    );
    return `linear-gradient(to right, ${parts.join(', ')})`;
  });

  /** Podpisy pod paskiem: skrajne zawsze, a pośrednie tylko tam, gdzie jest dość miejsca. */
  protected readonly ticks = computed(() => {
    const stops = this.positioned();
    const last = stops[stops.length - 1];
    const ticks = [stops[0]];
    for (const stop of stops.slice(1, -1)) {
      const farFromPrevious = stop.position - ticks[ticks.length - 1].position >= MIN_LABEL_GAP;
      const farFromLast = last.position - stop.position >= MIN_LABEL_GAP;
      if (farFromPrevious && farFromLast) ticks.push(stop);
    }
    return [...ticks, last];
  });
}
