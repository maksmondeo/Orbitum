import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  convertToParamMap,
  Params,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard, guestGuard } from './auth-guards';
import { Session } from './session';

describe('guardy tras', () => {
  let session: Session;

  /** Uruchamia guard tak, jak zrobiłby to router. Wynik: `true` albo adres, na który guard przekierował. */
  function run(guard: CanActivateFn, url: string, queryParams: Params = {}): true | string {
    const route = { queryParamMap: convertToParamMap(queryParams) } as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => guard(route, state));
    return result === true ? true : TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(Session);
  });

  afterEach(() => localStorage.clear());

  describe('authGuard', () => {
    it('bez tokenu przenosi na logowanie z adresem powrotu', () => {
      expect(run(authGuard, '/konto')).toBe('/logowanie?powrot=%2Fkonto');
    });

    it('z ważnym tokenem przepuszcza', () => {
      vi.spyOn(session, 'hasValidToken').mockReturnValue(true);

      expect(run(authGuard, '/konto')).toBe(true);
    });

    it('z wygasłym tokenem kończy sesję i przenosi na logowanie', () => {
      session.start('abc');

      expect(run(authGuard, '/konto')).toBe('/logowanie?powrot=%2Fkonto');
      expect(session.endReason()).toBe('expired');
    });
  });

  describe('guestGuard', () => {
    it('bez tokenu przepuszcza', () => {
      expect(run(guestGuard, '/logowanie')).toBe(true);
    });

    it('z ważnym tokenem przenosi tam, dokąd prowadzi powrot', () => {
      vi.spyOn(session, 'hasValidToken').mockReturnValue(true);

      expect(run(guestGuard, '/logowanie', { powrot: '/konto' })).toBe('/konto');
    });

    it('z ważnym tokenem i bez powrotu przenosi na mapę', () => {
      vi.spyOn(session, 'hasValidToken').mockReturnValue(true);

      expect(run(guestGuard, '/logowanie')).toBe('/');
    });
  });
});
