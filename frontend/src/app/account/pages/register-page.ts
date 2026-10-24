import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
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
  selector: 'app-register-page',
  imports: [FormField, FormRoot, RouterLink, HlmButtonImports, HlmInputImports, HlmLabelImports],
  template: `
    <main class="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-8 sm:py-12">
      <h1 class="text-2xl font-semibold">Załóż konto</h1>

      <form [formRoot]="registerForm" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label hlmLabel for="register-email">Adres e-mail</label>
          <input
            hlmInput
            id="register-email"
            type="email"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            [formField]="registerForm.email"
            [aria-invalid]="emailError() !== null"
            [aria-describedby]="emailError() ? 'register-email-error' : null"
          />
          @if (emailError(); as message) {
            <p id="register-email-error" class="text-destructive text-sm">{{ message }}</p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <label hlmLabel for="register-password">Hasło</label>
          <input
            hlmInput
            id="register-password"
            type="password"
            autocomplete="new-password"
            [formField]="registerForm.password"
            [aria-invalid]="passwordError() !== null"
            [aria-describedby]="
              passwordError() ? 'register-password-hint register-password-error' : 'register-password-hint'
            "
          />
          <p id="register-password-hint" class="text-muted-foreground text-sm">Co najmniej 8 znaków.</p>
          @if (passwordError(); as message) {
            <p id="register-password-error" class="text-destructive text-sm">{{ message }}</p>
          }
        </div>

        <div class="flex flex-col gap-2">
          <label hlmLabel for="register-confirm">Powtórz hasło</label>
          <input
            hlmInput
            id="register-confirm"
            type="password"
            autocomplete="new-password"
            [formField]="registerForm.confirmPassword"
            [aria-invalid]="confirmError() !== null"
            [aria-describedby]="confirmError() ? 'register-confirm-error' : null"
          />
          @if (confirmError(); as message) {
            <p id="register-confirm-error" class="text-destructive text-sm">{{ message }}</p>
          }
        </div>

        @if (formError(); as message) {
          <p role="alert" class="text-destructive text-sm">{{ message }}</p>
        }

        <button
          hlmBtn
          type="submit"
          [disabled]="registerForm().submitting()"
          [attr.aria-busy]="registerForm().submitting() ? 'true' : null"
        >
          {{ registerForm().submitting() ? 'Zakładam konto…' : 'Załóż konto' }}
        </button>
      </form>

      <p class="text-sm">
        Masz już konto?
        <a
          routerLink="/logowanie"
          [queryParams]="linkParams()"
          class="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >Zaloguj się</a
        >
      </p>
    </main>
  `,
})
export default class RegisterPage {
  private readonly api = inject(AccountApi);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** `?powrot=` z adresu, surowy. Do nawigacji przechodzi przez `safeReturnUrl`. */
  private readonly returnParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(RETURN_PARAM))),
    { initialValue: null },
  );

  /** Ten sam `powrot` dla linku do logowania. `null` znika z adresu. */
  protected readonly linkParams = computed(() => ({ [RETURN_PARAM]: this.returnParam() }));

  private readonly model = signal({ email: '', password: '', confirmPassword: '' });

  /** Błąd z serwera, który nie dotyczy jednego pola (np. brak połączenia). Powód, dla którego nie jest błędem formularza, opisuje `LoginPage.formError`. */
  protected readonly formError = signal<string | null>(null);

  protected readonly registerForm = form(
    this.model,
    (path) => {
      emailRules(path.email);
      passwordRules(path.password);
      validate(path.confirmPassword, ({ value, valueOf }) =>
        value() === valueOf(path.password) ? null : { kind: 'mismatch', message: 'Hasła nie są takie same.' },
      );
    },
    {
      submission: {
        action: async (field) => {
          this.formError.set(null);
          const { email, password } = field().value();
          let token: string;
          try {
            token = await firstValueFrom(this.api.register({ email, password }));
          } catch (error) {
            const status = error instanceof HttpErrorResponse ? error.status : -1;
            const { field: target, message } = accountErrorMessage(status, 'register');
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

  protected readonly emailError = computed(() => visibleError(this.registerForm.email));
  protected readonly passwordError = computed(() => visibleError(this.registerForm.password));
  protected readonly confirmError = computed(() => visibleError(this.registerForm.confirmPassword));
}
