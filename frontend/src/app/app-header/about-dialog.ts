import { Component, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';

/**
 * Przycisk „Jak to działa?” z oknem „Jak działa Orbitum” (FR-005). Gość widzi w oknie przejście do
 * rejestracji i logowania, zalogowany tylko „Zamknij”.
 *
 * Przyciski przejścia są linkami, bo prowadzą na inną stronę. Okno zamykają przed nawigacją: router
 * ładuje stronę asynchronicznie, więc `close()` z kliknięcia zawsze wyprzedza zmianę widoku i warstwa
 * CDK nie zostaje nad nową stroną z uwięzionym fokusem.
 */
@Component({
  selector: 'app-about-dialog',
  imports: [RouterLink, HlmButtonImports, HlmDialogImports],
  template: `
    <hlm-dialog #dialog="hlmDialog">
      <button
        hlmBtn
        hlmDialogTrigger
        variant="ghost"
        type="button"
        aria-label="Jak to działa?"
        class="gap-1.5"
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
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
        <span class="max-sm:hidden">Jak to działa?</span>
      </button>

      <hlm-dialog-content *hlmDialogPortal class="sm:max-w-md">
        <hlm-dialog-header>
          <h2 hlmDialogTitle>Jak działa Orbitum</h2>
          <div hlmDialogDescription class="flex flex-col gap-3">
            <p>
              Modele pogodowe dają różne prognozy, a z góry nie wiadomo, któremu ufać w danym
              miejscu. Orbitum sprawdza na danych z ostatnich 60 dni, jak mylił się każdy model w
              każdym punkcie siatki nad Polską. Prognoza na mapie to mieszanka modeli: więcej waży
              ten, który mylił się w danym miejscu mniej.
            </p>
            <p>
              Kliknij miejsce na mapie, żeby zobaczyć prognozę na 7 dni i to, jak modele wypadły w
              tym punkcie.
            </p>
            <p>
              Po założeniu konta ustawisz alert, np. „temperatura poniżej 0 °C nad moją działką”, i
              dostaniesz wiadomość na Telegramie.
            </p>
          </div>
        </hlm-dialog-header>

        <hlm-dialog-footer>
          @if (loggedIn()) {
            <button hlmBtn hlmDialogClose type="button">Zamknij</button>
          } @else {
            <a
              hlmBtn
              variant="outline"
              routerLink="/logowanie"
              [queryParams]="queryParams()"
              (click)="dialog.close()"
              >Zaloguj się</a
            >
            <a
              hlmBtn
              routerLink="/rejestracja"
              [queryParams]="queryParams()"
              (click)="dialog.close()"
              >Załóż konto</a
            >
          }
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class AboutDialog {
  /** Czy ktoś jest zalogowany: od tego zależą przyciski w oknie. */
  readonly loggedIn = input.required<boolean>();
  /** `?powrot=` dla linków do logowania i rejestracji, ten sam co w nagłówku. */
  readonly queryParams = input.required<Params>();
}
