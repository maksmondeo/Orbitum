import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api/api-url';
import { BacktestApi } from './backtest-api';

describe('BacktestApi', () => {
  const url = 'http://api.test/models';
  let api: BacktestApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test' },
      ],
    });
    api = TestBed.inject(BacktestApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pyta o zmienną i współrzędne punktu', () => {
    api.modelRanking('pressure_msl', 51.2465, 22.5684).subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('variable')).toBe('pressure_msl');
    expect(req.request.params.get('lat')).toBe('51.2465');
    expect(req.request.params.get('lon')).toBe('22.5684');
    req.flush({ lat: 51.25, lon: 22.5, buckets: [] });
  });

  it('oddaje węzeł i zamienia „1-6” na liczby', () => {
    let result: unknown;
    api.modelRanking('temperature_2m', 51.25, 22.5).subscribe((r) => (result = r));

    http.expectOne((r) => r.url === url).flush({
      lat: 51.25,
      lon: 22.5,
      buckets: [{ lead_h: '7-12', best: 'ECMWF AIFS', rmse: { 'ECMWF AIFS': 1.193, 'DWD ICON': 1.219 } }],
    });

    expect(result).toEqual({
      lat: 51.25,
      lon: 22.5,
      buckets: [
        { fromHour: 7, toHour: 12, best: 'ECMWF AIFS', rmse: { 'ECMWF AIFS': 1.193, 'DWD ICON': 1.219 } },
      ],
    });
  });

  it('drugie takie samo pytanie bierze dane z pamięci', () => {
    api.modelRanking('temperature_2m', 52, 19).subscribe();
    http.expectOne((r) => r.url === url).flush({ lat: 52, lon: 19, buckets: [] });

    api.modelRanking('temperature_2m', 52, 19).subscribe();

    http.expectNone((r) => r.url === url);
  });

  it('przekazuje błąd HTTP do subskrybenta', () => {
    let status: number | undefined;
    api.modelRanking('temperature_2m', 52, 19).subscribe({ error: (e) => (status = e.status) });

    http.expectOne((r) => r.url === url).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });
});
