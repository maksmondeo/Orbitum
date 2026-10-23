import { Directive, booleanAttribute, input } from '@angular/core';
import { BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
import { BrnInput } from '@spartan-ng/brain/input';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: '[hlmInput]',
  exportAs: 'hlmInput',
  hostDirectives: [
    { directive: BrnInput, inputs: ['id', 'forceInvalid'] },
    { directive: BrnFieldControlDescribedBy, inputs: ['aria-describedby'] },
  ],
  host: {
    'data-slot': 'input',
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
  },
})
export class HlmInput {
  /**
   * Błąd pola (`aria-invalid`). Własny, bo BrnInput ustawia ten atrybut tylko z NgControl,
   * którego Signal Forms nie używają, i nadpisuje go wartością null już przy pierwszym renderze.
   */
  public readonly invalid = input(false, { alias: 'aria-invalid', transform: booleanAttribute });

  constructor() {
    classes(
      () =>
        'dark:bg-input/30 border-input aria-invalid:border-destructive data-[matches-spartan-invalid=true]:border-destructive disabled:bg-muted h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    );
  }
}
