import { Component, input, model } from '@angular/core';
import { Variable } from '../forecast/forecast-types';
import { SCALES } from '../map-render/color-scale';

const VARIABLES = Object.keys(SCALES) as Variable[];

/**
 * Przełącznik zmiennej (temperatura / ciśnienie). Natywne radio, więc strzałki działają bez naszego
 * kodu. `name` musi być unikalne na stronie: dwa przełączniki z tym samym `name` to dla przeglądarki
 * jedna grupa radio.
 */
@Component({
  selector: 'app-variable-switch',
  template: `
    <fieldset class="flex flex-col gap-1">
      <legend class="mb-1 text-sm font-medium">Zmienna</legend>
      <div class="inline-flex rounded-md border">
        @for (v of variables; track v) {
          <label
            class="cursor-pointer px-4 py-2 text-sm first:rounded-l-md last:rounded-r-md has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2"
          >
            <input
              type="radio"
              class="sr-only"
              [name]="name()"
              [value]="v"
              [checked]="value() === v"
              (change)="value.set(v)"
            />
            {{ scales[v].label }}
          </label>
        }
      </div>
    </fieldset>
  `,
  host: { class: 'block' },
})
export class VariableSwitch {
  readonly value = model.required<Variable>();
  readonly name = input.required<string>();

  protected readonly variables = VARIABLES;
  protected readonly scales = SCALES;
}
