import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authInterceptor, withAuth } from './auth-interceptor';
import { Session } from './session';

describe('authInterceptor', () => {
  const url = 'http://api.test/me';
  const router = { url: '/konto', navigate: vi.fn() };
  let client: HttpClient;
  let http: HttpTestingController;
  let session: Session;

  beforeEach(() => {
    localStorage.clear();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.start('abc');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('nie dokleja tokenu do zapytania bez withAuth()', () => {
    client.get(url).subscribe();

    expect(http.expectOne(url).request.headers.has('Authorization')).toBe(false);
  });

  it('dokleja token do zapytania z withAuth()', () => {
    client.get(url, { context: withAuth() }).subscribe();

    expect(http.expectOne(url).request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('401 kończy sesję i przenosi na logowanie z adresem powrotu', () => {
    let status: number | undefined;
    client.get(url, { context: withAuth() }).subscribe({ error: (e) => (status = e.status) });

    http.expectOne(url).flush('nie', { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(session.token()).toBeNull();
    expect(session.endReason()).toBe('expired');
    expect(router.navigate).toHaveBeenCalledWith(['/logowanie'], { queryParams: { powrot: '/konto' } });
  });

  it('401 z zapytania bez withAuth() nie rusza sesji', () => {
    client.get(url).subscribe({ error: () => {} });

    http.expectOne(url).flush('nie', { status: 401, statusText: 'Unauthorized' });

    expect(session.token()).toBe('abc');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('inny błąd niż 401 nie kończy sesji', () => {
    client.get(url, { context: withAuth() }).subscribe({ error: () => {} });

    http.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(session.token()).toBe('abc');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
