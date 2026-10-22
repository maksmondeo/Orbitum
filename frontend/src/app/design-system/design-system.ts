import { Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { contrastRatio } from '../color/contrast';
import { toHex } from '../color/dom-color';
import { Variable } from '../forecast/forecast-types';
import { ColorScale, Rgb, SCALES } from '../map-render/color-scale';
import { VariableSwitch } from '../variable-switch/variable-switch';
import { COLOR_PAIRS, EXTRA_SAMPLES, STATE_PAIRS } from './pairs';

interface Measurement {
  ratio: number;
  minimum: number;
}

/** Własność CSS, z której czytamy kolor "pierwszoplanowy" próbki. */
const FOREGROUND_PROPERTY = {
  text: 'color',
  border: 'borderTopColor',
  outline: 'outlineColor',
} as const;

const ratioFormat = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

@Component({
  selector: 'app-design-system',
  imports: [VariableSwitch],
  templateUrl: './design-system.html',
})
export default class DesignSystem {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly colorPairs = COLOR_PAIRS;
  protected readonly statePairs = STATE_PAIRS;
  protected readonly extraSamples = EXTRA_SAMPLES;
  protected readonly scales = Object.values(SCALES);
  protected readonly sampleVariable = signal<Variable>('temperature_2m');

  protected readonly typeScale = [
    { name: 'text-3xl', classes: 'text-3xl font-semibold' },
    { name: 'text-2xl', classes: 'text-2xl font-semibold' },
    { name: 'text-xl', classes: 'text-xl font-semibold' },
    { name: 'text-base', classes: 'text-base' },
    { name: 'text-sm', classes: 'text-sm' },
    { name: 'text-xs', classes: 'text-xs' },
  ] as const;

  protected readonly radii = [
    { name: 'rounded-sm', classes: 'rounded-sm' },
    { name: 'rounded-md', classes: 'rounded-md' },
    { name: 'rounded-lg', classes: 'rounded-lg' },
    { name: 'rounded-xl', classes: 'rounded-xl' },
  ] as const;

  protected readonly shadows = [
    { name: 'shadow-sm', classes: 'shadow-sm' },
    { name: 'shadow-md', classes: 'shadow-md' },
    { name: 'shadow-lg', classes: 'shadow-lg' },
  ] as const;

  /** Kontrast policzony z kolorów próbek, klucz = `data-key` próbki. */
  protected readonly measurements = signal<Record<string, Measurement>>({});

  constructor() {
    // Kolory czytamy z wyrenderowanych próbek, a nie z kopii wartości w TS:
    // strona nie może rozjechać się ze stylami.
    afterNextRender(() => this.measure());
  }

  /** Pasek skali: pozycja stopnia jest proporcjonalna do jego wartości. */
  protected gradient(scale: ColorScale): string {
    const min = scale.stops[0].value;
    const span = scale.stops[scale.stops.length - 1].value - min;
    const parts = scale.stops.map(
      (stop) => `${this.swatch(stop.color)} ${(((stop.value - min) / span) * 100).toFixed(1)}%`,
    );
    return `linear-gradient(to right, ${parts.join(', ')})`;
  }

  protected swatch(color: Rgb): string {
    return `rgb(${color.join(' ')})`;
  }

  protected format(m: Measurement): string {
    // Obcinamy, a nie zaokrąglamy: 4,46 nie może wyglądać jak 4,5 i przejść.
    const shown = ratioFormat.format(Math.floor(m.ratio * 10) / 10);
    return `${shown}:1 · ${m.ratio >= m.minimum ? 'AA ✓' : 'poniżej AA ✗'}`;
  }

  private measure(): void {
    const result: Record<string, Measurement> = {};
    const samples = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-key]');

    for (const sample of samples) {
      const kind = (sample.dataset['kind'] ?? 'text') as keyof typeof FOREGROUND_PROPERTY;
      const style = getComputedStyle(sample);
      result[sample.dataset['key']!] = {
        ratio: contrastRatio(toHex(style[FOREGROUND_PROPERTY[kind]]), toHex(style.backgroundColor)),
        minimum: Number(sample.dataset['min'] ?? 4.5),
      };
    }
    this.measurements.set(result);
  }
}
