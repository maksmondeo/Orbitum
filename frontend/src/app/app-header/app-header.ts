import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { filter, map, of, startWith, switchMap, timer } from 'rxjs';
import { RETURN_PARAM, returnUrlFor } from '../session/return-url';
import { Session } from '../session/session';
import { AboutDialog } from './about-dialog';

/** Jak długo nagłówek pokazuje „Wylogowano.”. */
const LOGGED_OUT_NOTICE_MS = 5000;

/**
 * Nagłówek na każdej stronie: logo, „Jak to działa?” i przyciski konta zależne od sesji.
 * Czyta tylko `Session` i router, nie wysyła żadnych zapytań (zob. reguła 401 w interceptorze):
 * e-mail zalogowanego widać dopiero na `/konto`.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, HlmButtonImports, AboutDialog],
  template: `
    <header class="relative flex items-center gap-2 border-b px-3 py-2 sm:px-4">
      <a
        routerLink="/"
        aria-label="Orbitum, mapa prognozy"
        class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <!-- alt jest pusty, bo nazwę dla czytnika ekranu ma link (aria-label). -->
        <img
          src="images/logo-text.svg"
          width="899"
          height="305"
          alt=""
          class="h-8 w-auto sm:h-10"
        />
      </a>

      <!-- Poniżej sm przyciski są mniejsze (tekst 14 px, węższy odstęp), żeby na 360 px zmieścić się w wierszu. -->
      <div class="ml-auto flex items-center gap-1 sm:gap-2">
        <!-- Region jest w DOM-ie od początku, bo czytnik ekranu zapowiada tylko zmiany w już istniejącym.
             Na wąskim ekranie komunikat wisi pod nagłówkiem, żeby nie wypchnąć przycisków z wiersza. -->
        <div
          role="status"
          class="max-sm:absolute max-sm:top-full max-sm:right-3 max-sm:z-20 max-sm:mt-1"
        >
          @if (showLoggedOut()) {
            <p class="bg-muted text-foreground rounded-md px-3 py-1 text-sm max-sm:shadow-md">
              Wylogowano.
            </p>
          }
        </div>

        <app-about-dialog [loggedIn]="session.isLoggedIn()" [queryParams]="authParams()" />

        @if (session.isLoggedIn()) {
          <a hlmBtn variant="outline" routerLink="/konto" class="max-sm:px-2 max-sm:text-sm"
            >Moje konto</a
          >
          <button hlmBtn type="button" class="max-sm:px-2 max-sm:text-sm" (click)="logout()">
            Wyloguj
          </button>
        } @else {
          <a
            hlmBtn
            variant="outline"
            routerLink="/logowanie"
            [queryParams]="authParams()"
            class="max-sm:px-2 max-sm:text-sm"
            >Zaloguj się</a
          >
          <a
            hlmBtn
            routerLink="/rejestracja"
            [queryParams]="authParams()"
            class="max-sm:px-2 max-sm:text-sm"
            >Załóż konto</a
          >
        }
      </div>
    </header>
  `,
})
export class AppHeader {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  /** Bieżący adres, z `?lat=&lon=`, więc po zalogowaniu wrócimy do punktu na mapie. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** `powrot` dla linków do logowania i rejestracji; `null` znika z adresu. */
  protected readonly authParams = computed(() => ({ [RETURN_PARAM]: returnUrlFor(this.url()) }));

  /** „Wylogowano.” przez kilka sekund po wylogowaniu. Kolejne wylogowanie zaczyna odliczanie od nowa. */
  protected readonly showLoggedOut = toSignal(
    toObservable(this.session.endReason).pipe(
      switchMap((reason) =>
        reason === 'logout'
          ? timer(LOGGED_OUT_NOTICE_MS).pipe(
              map(() => false),
              startWith(true),
            )
          : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected logout(): void {
    this.session.end('logout');
    void this.router.navigateByUrl('/');
  }
}
