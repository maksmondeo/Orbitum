import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject } from 'rxjs';
import { Session } from '../../session/session';
import { AccountApi, Credentials } from '../account-api';
import LoginPage from './login-page';

/** Zapamiętuje pytania o logowanie, a odpowiedź na każde podaje test. */
class FakeAccountApi {
  readonly calls: { credentials: Credentials; response: Subject<string> }[] = [];

  login(credentials: Credentials): Observable<string> {
    const response = new Subject<string>();
    this.calls.push({ credentials, response });
    return response;
  }
}

describe('LoginPage', () => {
  let api: FakeAccountApi;

  /** Otwiera stronę pod `/logowanie?powrot=%2Fkonto`, jak po przekierowaniu z chronionej strony. */
  async function openPage() {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/logowanie?powrot=%2Fkonto', LoginPage);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const host = harness.routeNativeElement as HTMLElement;

    const type = (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submitButton = () => host.querySelector<HTMLButtonElement>('button[type=submit]')!;
    /** Czeka jeden takt zdarzeń, żeby obietnice akcji wysyłki się dokończyły, i odświeża widok. */
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    };
    const signIn = async () => {
      type('login-email', 'jan@example.pl');
      type('login-password', 'tajnehaslo');
      submitButton().click();
      await settle();
    };
    const lastResponse = () => api.calls[api.calls.length - 1].response;

    return { host, navigate, submitButton, settle, signIn, lastResponse };
  }

  beforeEach(() => {
    localStorage.clear();
    api = new FakeAccountApi();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountApi, useValue: api },
        provideRouter([{ path: 'logowanie', component: LoginPage }]),
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('wysyła e-mail i hasło z formularza', async () => {
    const { signIn } = await openPage();

    await signIn();

    expect(api.calls[0].credentials).toEqual({ email: 'jan@example.pl', password: 'tajnehaslo' });
  });

  it('w trakcie wysyłki pokazuje „Loguję…” i wyłącza przycisk', async () => {
    const { signIn, submitButton } = await openPage();

    await signIn();

    expect(submitButton().textContent).toContain('Loguję…');
    expect(submitButton().disabled).toBe(true);
  });

  it('401 pokazuje „Zły e-mail albo hasło.” i nie zapisuje tokenu', async () => {
    const { host, navigate, signIn, settle, lastResponse } = await openPage();
    await signIn();

    lastResponse().error(new HttpErrorResponse({ status: 401 }));
    await settle();

    expect(host.querySelector('[role=alert]')?.textContent).toContain('Zły e-mail albo hasło.');
    expect(TestBed.inject(Session).token()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('po błędzie można wysłać formularz jeszcze raz bez poprawiania pól', async () => {
    const { submitButton, signIn, settle, lastResponse } = await openPage();
    await signIn();
    lastResponse().error(new HttpErrorResponse({ status: 0 }));
    await settle();

    submitButton().click();
    await settle();

    expect(api.calls.length).toBe(2);
  });

  it('po udanym logowaniu zapisuje sesję i wraca na adres z powrot', async () => {
    const { navigate, signIn, settle, lastResponse } = await openPage();
    await signIn();

    lastResponse().next('jwt-token');
    await settle();

    expect(TestBed.inject(Session).token()).toBe('jwt-token');
    expect(navigate).toHaveBeenCalledWith('/konto');
  });
});
