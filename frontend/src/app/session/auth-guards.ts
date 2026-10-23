import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RETURN_PARAM, returnUrlFor, safeReturnUrl } from './return-url';
import { Session } from './session';

/** Ważny token to aktywna sesja. Token, który jest, ale wygasł, kończy sesję, żeby nagłówek nie udawał zalogowanego. */
function isSessionActive(session: Session): boolean {
  if (session.hasValidToken()) return true;
  if (session.isLoggedIn()) session.end('expired');
  return false;
}

/** Chroniona trasa: bez ważnego tokenu na logowanie, z adresem powrotu. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (isSessionActive(inject(Session))) return true;

  return inject(Router).createUrlTree(['/logowanie'], {
    queryParams: { [RETURN_PARAM]: returnUrlFor(state.url) },
  });
};

/** Logowanie i rejestracja nie mają sensu dla zalogowanego: odsyła tam, dokąd prowadzi `powrot`. */
export const guestGuard: CanActivateFn = (route) => {
  if (!isSessionActive(inject(Session))) return true;

  return inject(Router).parseUrl(safeReturnUrl(route.queryParamMap.get(RETURN_PARAM)));
};
