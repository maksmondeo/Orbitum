import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { catchError, map, of, switchMap } from 'rxjs';
import { formatDate } from '../../forecast/warsaw-time';
import { Session } from '../../session/session';
import { AccountApi, User } from '../account-api';

/** Wynik pobrania konta. `user: null` to błąd. */
interface Result {
  attempt: number;
  user: User | null;
}

/**
 * „Moje konto”: pierwsza chroniona strona. Dane z `/me` pokazują, że token działa na serwerze,
 * a nie tylko, że `exp` w przeglądarce jeszcze nie minął. 401 obsługuje interceptor (wylogowanie
 * i przejście na logowanie), więc strona zajmuje się tylko pozostałymi błędami.
 */
@Component({
  selector: 'app-account-page',
  imports: [HlmButtonImports],
  template: `
    <main class="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8 sm:py-12">
      <h1 class="text-2xl font-semibold">Moje konto</h1>

      @switch (status()) {
        @case ('loading') {
          <p role="status" class="text-muted-foreground">Ładuję dane konta…</p>
        }
        @case ('error') {
          <div role="alert" class="flex flex-col items-start gap-3">
            <p class="text-destructive">
              Nie udało się pobrać danych konta. Sprawdź połączenie i spróbuj ponownie.
            </p>
            <button hlmBtn variant="outline" type="button" (click)="retry()">
              Spróbuj ponownie
            </button>
          </div>
        }
        @case ('ready') {
          <div class="flex flex-col gap-1">
            <p class="text-lg font-medium break-all">{{ user()?.email }}</p>
            <p class="text-muted-foreground text-sm">Konto założone: {{ createdOn() }}</p>
          </div>
        }
      }

      <button hlmBtn variant="outline" type="button" class="self-start" (click)="logout()">
        Wyloguj
      </button>
    </main>
  `,
})
export default class AccountPage {
  private readonly api = inject(AccountApi);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  /** „Spróbuj ponownie” zwiększa numer, co jest nowym pytaniem, więc strona wraca do ładowania. */
  private readonly attempt = signal(0);

  private readonly latestResult = toSignal(
    toObservable(this.attempt).pipe(
      // Nowe pytanie anuluje poprzednie, więc spóźniona odpowiedź nie nadpisze nowszej.
      switchMap((attempt) =>
        this.api.me().pipe(
          map((user): Result => ({ attempt, user })),
          catchError((error: unknown) => {
            console.error('Nie udało się pobrać danych konta', error);
            return of<Result>({ attempt, user: null });
          }),
        ),
      ),
    ),
    { initialValue: null },
  );

  /** Ostatnia odpowiedź, ale tylko na bieżącą próbę. */
  private readonly result = computed(() => {
    const latest = this.latestResult();
    return latest?.attempt === this.attempt() ? latest : null;
  });

  protected readonly user = computed(() => this.result()?.user ?? null);

  protected readonly status = computed<'loading' | 'error' | 'ready'>(() => {
    const result = this.result();
    if (!result) return 'loading';
    return result.user ? 'ready' : 'error';
  });

  protected readonly createdOn = computed(() => {
    const user = this.user();
    return user ? formatDate(user.createdAt) : '';
  });

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  protected logout(): void {
    this.session.end('logout');
    void this.router.navigateByUrl('/');
  }
}
