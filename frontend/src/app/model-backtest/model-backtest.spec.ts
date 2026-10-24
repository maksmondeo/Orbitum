import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Variable } from '../forecast/forecast-types';
import { BacktestApi, PointBacktest } from './backtest-api';
import { ModelBacktest } from './model-backtest';

const RANKING: PointBacktest = {
  lat: 51.25,
  lon: 22.5,
  buckets: [
    { fromHour: 1, toHour: 6, best: 'A', rmse: { A: 1.2, B: 2 } },
    { fromHour: 7, toHour: 12, best: 'B', rmse: { A: 3, B: 2.5 } },
    { fromHour: 13, toHour: 18, best: 'B', rmse: { A: 3, B: 2.5 } },
  ],
};

/** Zapamiętuje pytania, a odpowiedź podaje test. */
class FakeApi {
  readonly calls: { variable: Variable; lat: number; lon: number; response: Subject<PointBacktest> }[] = [];

  modelRanking(variable: Variable, lat: number, lon: number): Observable<PointBacktest> {
    const response = new Subject<PointBacktest>();
    this.calls.push({ variable, lat, lon, response });
    return response;
  }
}

describe('ModelBacktest', () => {
  let api: FakeApi;

  function setup() {
    TestBed.configureTestingModule({ providers: [{ provide: BacktestApi, useValue: api }] });
    const fixture = TestBed.createComponent(ModelBacktest);
    fixture.componentRef.setInput('point', { lat: 51.2465, lon: 22.5684 });
    fixture.componentRef.setInput('variable', 'temperature_2m');
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const alert = () => host.querySelector('[role=alert]');
    const toggle = () => host.querySelector('button[aria-controls]')!;
    const lastCall = () => api.calls[api.calls.length - 1];
    /** Odpowiada na ostatnie pytanie i daje Angularowi odświeżyć widok. */
    const respond = (ranking: PointBacktest) => {
      lastCall().response.next(ranking);
      fixture.detectChanges();
    };
    return { fixture, host, alert, toggle, lastCall, respond };
  }

  beforeEach(() => {
    api = new FakeApi();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('do czasu odpowiedzi pokazuje ładowanie', () => {
    const { host, lastCall } = setup();

    expect(lastCall()).toMatchObject({ variable: 'temperature_2m', lat: 51.2465, lon: 22.5684 });
    expect(host.querySelector('[role=status]')?.textContent).toContain('Ładuję');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('błąd HTTP daje komunikat bez surowego tekstu, a ponowienie wysyła żądanie', () => {
    const { fixture, host, alert, lastCall } = setup();
    lastCall().response.error(new Error('500'));
    fixture.detectChanges();

    expect(alert()?.textContent).toContain('Nie udało się');
    expect(alert()?.textContent).not.toContain('500');

    alert()!.querySelector('button')!.click();
    fixture.detectChanges();

    expect(api.calls.length).toBe(2);
    expect(host.querySelector('[role=status]')?.textContent).toContain('Ładuję');
  });

  it('puste przedziały dają „brak wyników”', () => {
    const { host, respond } = setup();
    respond({ ...RANKING, buckets: [] });

    expect(host.querySelector('[role=status]')?.textContent).toContain('Brak wyników');
    expect(host.querySelector('button[aria-controls]')).toBeNull();
  });

  it('podsumowanie skleja kolejne przedziały z tym samym modelem', () => {
    const { host, respond } = setup();
    respond(RANKING);

    const lines = Array.from(host.querySelectorAll('li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(lines).toEqual(['1–6 h naprzód: A', '7–18 h naprzód: B']);
  });

  it('tabela jest zwinięta, a przycisk ją rozwija i ustawia aria-expanded', () => {
    const { fixture, host, toggle, respond } = setup();
    respond(RANKING);

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('table')).toBeNull();

    toggle().dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelectorAll('tbody tr').length).toBe(3);
    expect(host.textContent).toContain('▲ oznacza model');
  });

  it('zmiana zmiennej wysyła żądanie z ciśnieniem, a rozwinięta tabela zostaje rozwinięta', () => {
    const { fixture, toggle, respond, lastCall } = setup();
    respond(RANKING);
    toggle().dispatchEvent(new MouseEvent('click'));

    fixture.componentRef.setInput('variable', 'pressure_msl');
    fixture.detectChanges();
    expect(api.calls.length).toBe(2);
    expect(lastCall().variable).toBe('pressure_msl');

    respond(RANKING);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().textContent).toContain('hPa');
  });
});
