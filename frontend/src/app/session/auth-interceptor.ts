import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { RETURN_PARAM, returnUrlFor } from './return-url';
import { Session } from './session';

const WITH_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * Znacznik zapytania, które wymaga tokenu: `http.get(url, { context: withAuth() })`.
 * Tylko takie zapytania dostają nagłówek `Authorization`. Zapytania mapy go nie mają celowo:
 * z nagłówkiem przeglądarka przed każdym nowym URL-em wysyła jeszcze zapytanie OPTIONS (preflight).
 *
 * Zasada: `withAuth()` wolno użyć tylko w zapytaniach z chronionych stron. Interceptor przy każdym
 * 401 kończy sesję i przenosi na logowanie, więc 401 z publicznej strony wyrzuciłby gościa z mapy.
 */
export function withAuth(): HttpContext {
  return new HttpContext().set(WITH_AUTH, true);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.context.get(WITH_AUTH)) return next(req);

  const session = inject(Session);
  const router = inject(Router);
  const token = session.token();
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        session.end('expired');
        void router.navigate(['/logowanie'], {
          queryParams: { [RETURN_PARAM]: returnUrlFor(router.url) },
        });
      }
      return throwError(() => error);
    }),
  );
};
