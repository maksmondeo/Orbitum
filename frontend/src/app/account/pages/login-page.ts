import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { firstValueFrom, map } from 'rxjs';
import { RETURN_PARAM, safeReturnUrl } from '../../session/return-url';
import { Session } from '../../session/session';
import { AccountApi } from '../account-api';
import { accountErrorMessage } from '../account-errors';
import { emailRules, passwordRules } from '../credentials-rules';
import { visibleError } from '../field-error';

@Component({
  selector: 'app-login-page',
  imports: [FormField, FormRoot, RouterLink, HlmButtonImports, HlmInputImports, HlmLabelImports],
  template: `
    <main class="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8 sm:py-12">
      <h1 class="text-2xl font-semibold">Zaloguj się</h1>

      @if (notice(); as text) {
        <p role="status" class="text-muted-foreground text-sm">{{ text }}</p>
      }

      <form [formRoot]="loginForm" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label hlmLabel for="login-email">Adres e-mail</label>
          <input
            hlmInput
            id="login-email"
            type="email"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            [formField]="loginForm.email"
            [aria-invalid]="emailError() !== null"
            [aria-describedby]="emailError() ? 'login-email-error' : null"
          />
          @if (emailError(); as message) {
            <p id="login-email-error" class="text-destructive text-sm">{{ message }}</p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <label hlmLabel for="login-password">Hasło</label>
          <input
            hlmInput
            id="login-password"
            type="password"
            autocomplete="current-password"
            [formField]="loginForm.password"
            [aria-invalid]="passwordError() !== null"
            [aria-describedby]="passwordError() ? 'login-password-error' : null"
          />
          @if (passwordError(); as message) {
            <p id="login-password-error" class="text-destructive text-sm">{{ message }}</p>
          }
        </div>

        @if (formError(); as message) {
          <p role="alert" class="text-destructive text-sm">{{ message }}</p>
        }

        <button
          hlmBtn
          type="submit"
          [disabled]="loginForm().submitting()"
          [attr.aria-busy]="loginForm().submitting() ? 'true' : null"
        >
          {{ loginForm().submitting() ? 'Loguję…' : 'Zaloguj się' }}
        </button>
      </form>

      <p class="text-sm">
        Nie masz konta?
        <a
          routerLink="/rejestracja"
          [queryParams]="linkParams()"
          class="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >Załóż je</a
        >
      </p>
    </main>
  `,
})
export default class LoginPage {
  private readonly api = inject(AccountApi);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** `?powrot=` z adresu, surowy. Do nawigacji przechodzi przez `safeReturnUrl`. */
  private readonly returnParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(RETURN_PARAM))),
    { initialValue: null },
  );

  /** Ten sam `powrot` dla linku do rejestracji. `null` znika z adresu. */
  protected readonly linkParams = computed(() => ({ [RETURN_PARAM]: this.returnParam() }));

  protected readonly notice = computed(() => {
    if (this.session.endReason() === 'expired') return 'Sesja wygasła. Zaloguj się ponownie.';
    return this.returnParam() ? 'Zaloguj się, żeby przejść dalej.' : null;
  });

  private readonly model = signal({ email: '', password: '' });

  /**
   * Błąd z serwera, który nie dotyczy jednego pola (zły e-mail albo hasło, brak połączenia). Nie jest
   * błędem formularza z Signal Forms, bo taki błąd blokuje ponowne wysłanie, dopóki ktoś nie zmieni pola,
   * a po „Brak połączenia” trzeba móc kliknąć jeszcze raz.
   */
  protected readonly formError = signal<string | null>(null);

  protected readonly loginForm = form(
    this.model,
    (path) => {
      emailRules(path.email);
      passwordRules(path.password);
    },
    {
      submission: {
        action: async (field) => {
          this.formError.set(null);
          let token: string;
          try {
            token = await firstValueFrom(this.api.login(field().value()));
          } catch (error) {
            const status = error instanceof HttpErrorResponse ? error.status : -1;
            const { field: target, message } = accountErrorMessage(status, 'login');
            if (target) return { kind: 'server', message, fieldTree: field[target] };
            this.formError.set(message);
            return null;
          }

          this.session.start(token);
          await this.router.navigateByUrl(safeReturnUrl(this.returnParam()));
          return null;
        },
        onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
      },
    },
  );

  protected readonly emailError = computed(() => visibleError(this.loginForm.email));
  protected readonly passwordError = computed(() => visibleError(this.loginForm.password));
}
