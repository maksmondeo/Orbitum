import { FieldTree } from '@angular/forms/signals';

/**
 * Komunikat pierwszego błędu pola albo `null`. Błąd widać dopiero po dotknięciu pola
 * (wysłanie formularza dotyka wszystkie), żeby puste pole nie krzyczało, zanim ktoś zacznie pisać.
 */
export function visibleError(field: FieldTree<string>): string | null {
  const state = field();
  return state.touched() && state.invalid() ? (state.errors()[0]?.message ?? null) : null;
}
