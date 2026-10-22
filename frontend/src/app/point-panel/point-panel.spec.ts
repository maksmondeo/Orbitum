import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { PointForecast, Variable } from '../forecast/forecast-types';
import { PointPanel } from './point-panel';

/** Węzeł siatki z prawdziwego zapytania dla Lublina (patrz szkic panelu). */
const NODE: PointForecast = {
  lat: 51.25,
  lon: 22.5,
  values: [{ validTime: new Date('2026-10-22T12:00:00Z'), value: 8 }],
};

/** Zapamiętuje pytania, a odpowiedź podaje test. */
class FakeApi {
  readonly calls: { variable: Variable; lat: number; lon: number; response: Subject<PointForecast> }[] = [];

  pointForecast(variable: Variable, lat: number, lon: number): Observable<PointForecast> {
    const response = new Subject<PointForecast>();
    this.calls.push({ variable, lat, lon, response });
    return response;
  }
}

describe('PointPanel', () => {
  let api: FakeApi;

  function setup(initialVariable: Variable = 'temperature_2m') {
    TestBed.configureTestingModule({ providers: [{ provide: ForecastApi, useValue: api }] });
    const fixture = TestBed.createComponent(PointPanel);
    fixture.componentRef.setInput('point', { lat: 51.2465, lon: 22.5684 });
    fixture.componentRef.setInput('initialVariable', initialVariable);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const alert = () => host.querySelector('[role=alert]');
    const lastCall = () => api.calls[api.calls.length - 1];
    /** Odpowiada na ostatnie pytanie i daje Angularowi odświeżyć widok. */
    const respond = (forecast: PointForecast) => {
      lastCall().response.next(forecast);
      fixture.detectChanges();
    };
    return { fixture, host, alert, lastCall, respond };
  }

  beforeEach(() => {
    api = new FakeApi();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('pyta o kliknięty punkt i zmienną z mapy', () => {
    const { lastCall } = setup('pressure_msl');

    expect(lastCall()).toMatchObject({ variable: 'pressure_msl', lat: 51.2465, lon: 22.5684 });
  });

  it('pokazuje węzeł siatki i odległość od wskazanego miejsca', () => {
    const { host, respond } = setup();
    respond(NODE);

    expect(host.querySelector('h2')?.textContent).toBe('Punkt siatki 51,25° N 22,50° E');
    expect(host.textContent).toContain('4,8 km od wskazanego miejsca');
  });

  it('oddaje węzeł wyjściem', () => {
    const { fixture, respond } = setup();
    const nodes: unknown[] = [];
    fixture.componentInstance.nodeResolved.subscribe((node) => nodes.push(node));

    respond(NODE);

    expect(nodes).toEqual([{ lat: 51.25, lon: 22.5 }]);
  });

  it('do czasu odpowiedzi pokazuje ładowanie, a pusta lista daje „brak prognozy”', () => {
    const { host, respond } = setup();
    expect(host.querySelector('[role=status]')?.textContent).toContain('Ładuję');

    respond({ ...NODE, values: [] });
    expect(host.querySelector('[role=status]')?.textContent).toContain('Brak prognozy');
  });

  it('błąd HTTP daje komunikat z przyciskiem, a ponowienie wysyła żądanie', () => {
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

  it('zmiana zmiennej w panelu wysyła żądanie z ciśnieniem', () => {
    const { fixture, host } = setup();

    host.querySelector<HTMLInputElement>('input[value=pressure_msl]')!.click();
    fixture.detectChanges();

    expect(api.calls.length).toBe(2);
    expect(api.calls[1].variable).toBe('pressure_msl');
  });

  it('zmiana zmiennej na pasku mapy nie rusza zmiennej panelu', () => {
    const { fixture } = setup();

    fixture.componentRef.setInput('initialVariable', 'pressure_msl');
    fixture.detectChanges();

    expect(api.calls.length).toBe(1);
  });
});
