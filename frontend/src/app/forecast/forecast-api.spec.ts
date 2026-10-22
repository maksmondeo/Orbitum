import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api/api-url';
import { CACHE_TTL_MS } from '../api/cached-request';
import { ForecastApi } from './forecast-api';

describe('ForecastApi', () => {
  let api: ForecastApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'http://api.test' },
      ],
    });
    api = TestBed.inject(ForecastApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('mapForHour', () => {
    it('pyta o zmienną i godzinę w ISO UTC pod adresem z API_URL', () => {
      api.mapForHour('temperature_2m', new Date('2026-10-21T19:00:00Z')).subscribe();

      const req = http.expectOne((r) => r.url === 'http://api.test/forecast/map');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('variable')).toBe('temperature_2m');
      expect(req.request.params.get('valid_time')).toBe('2026-10-21T19:00:00.000Z');
      req.flush([]);
    });

    it('zwraca punkty siatki bez zmian', () => {
      const points = [
        { lat: 52, lon: 19, value: 11.5 },
        { lat: 52.25, lon: 19, value: 11.1 },
      ];
      let result: unknown;
      api
        .mapForHour('pressure_msl', new Date('2026-10-21T19:00:00Z'))
        .subscribe((p) => (result = p));

      http.expectOne((r) => r.url === 'http://api.test/forecast/map').flush(points);
      expect(result).toEqual(points);
    });

    it('przekazuje błąd HTTP do subskrybenta', () => {
      let status: number | undefined;
      api.mapForHour('temperature_2m', new Date('2026-10-21T19:00:00Z')).subscribe({
        error: (e) => (status = e.status),
      });

      http
        .expectOne((r) => r.url === 'http://api.test/forecast/map')
        .flush('boom', { status: 500, statusText: 'Server Error' });
      expect(status).toBe(500);
    });
  });

  describe('pointForecast', () => {
    const url = 'http://api.test/forecast';

    it('oddaje węzeł siatki i godziny z Date', () => {
      let result: unknown;
      api.pointForecast('temperature_2m', 51.2465, 22.5684).subscribe((p) => (result = p));

      http.expectOne((r) => r.url === url).flush({
        lat: 51.25,
        lon: 22.5,
        values: [{ valid_time: '2026-10-21T19:00:00+00:00', value: 10.5 }],
      });
      expect(result).toEqual({
        lat: 51.25,
        lon: 22.5,
        values: [{ validTime: new Date('2026-10-21T19:00:00Z'), value: 10.5 }],
      });
    });

    it('to samo żądanie przez pointForecast i singlePointSeries idzie do sieci raz', () => {
      api.pointForecast('temperature_2m', 52, 19).subscribe();
      http.expectOne((r) => r.url === url).flush({ lat: 52, lon: 19, values: [] });

      api.singlePointSeries('temperature_2m', 52, 19).subscribe();
      http.expectNone((r) => r.url === url);
    });

    it('przekazuje błąd HTTP do subskrybenta', () => {
      let status: number | undefined;
      api.pointForecast('temperature_2m', 52, 19).subscribe({ error: (e) => (status = e.status) });

      http.expectOne((r) => r.url === url).flush('boom', { status: 500, statusText: 'Server Error' });
      expect(status).toBe(500);
    });
  });

  describe('singlePointSeries', () => {
    it('pyta o zmienną i współrzędne punktu', () => {
      api.singlePointSeries('temperature_2m', 52, 19).subscribe();

      const req = http.expectOne((r) => r.url === 'http://api.test/forecast');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('variable')).toBe('temperature_2m');
      expect(req.request.params.get('lat')).toBe('52');
      expect(req.request.params.get('lon')).toBe('19');
      req.flush({ lat: 52, lon: 19, values: [] });
    });

    it('mapuje valid_time na Date i zmienia nazwę pola na validTime', () => {
      let result: unknown;
      api.singlePointSeries('temperature_2m', 52, 19).subscribe((s) => (result = s));

      http
        .expectOne((r) => r.url === 'http://api.test/forecast')
        .flush({
          lat: 52,
          lon: 19,
          values: [
            { valid_time: '2026-10-21T19:00:00+00:00', value: 10.5 },
            { valid_time: '2026-10-21T20:00:00+00:00', value: 9.8 },
          ],
        });
      expect(result).toEqual([
        { validTime: new Date('2026-10-21T19:00:00Z'), value: 10.5 },
        { validTime: new Date('2026-10-21T20:00:00Z'), value: 9.8 },
      ]);
    });

    it('pusta lista wartości daje pustą serię', () => {
      let result: unknown;
      api.singlePointSeries('temperature_2m', 52, 19).subscribe((s) => (result = s));

      http
        .expectOne((r) => r.url === 'http://api.test/forecast')
        .flush({ lat: 52, lon: 19, values: [] });
      expect(result).toEqual([]);
    });

    it('przekazuje błąd HTTP do subskrybenta', () => {
      let status: number | undefined;
      api
        .singlePointSeries('temperature_2m', 52, 19)
        .subscribe({ error: (e) => (status = e.status) });

      http
        .expectOne((r) => r.url === 'http://api.test/forecast')
        .flush('nope', { status: 422, statusText: 'Unprocessable' });
      expect(status).toBe(422);
    });
  });

  describe('cache', () => {
    const MAP_URL = 'http://api.test/forecast/map';
    const hour = new Date('2026-10-21T19:00:00Z');
    const points = [{ lat: 52, lon: 19, value: 11.5 }];

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    });

    afterEach(() => vi.useRealTimers());

    it('drugi odczyt w czasie TTL nie wysyła żądania i zwraca te same dane', () => {
      api.mapForHour('temperature_2m', hour).subscribe();
      http.expectOne((r) => r.url === MAP_URL).flush(points);

      vi.setSystemTime(Date.now() + CACHE_TTL_MS - 1);
      let result: unknown;
      api.mapForHour('temperature_2m', hour).subscribe((p) => (result = p));

      http.expectNone((r) => r.url === MAP_URL);
      expect(result).toEqual(points);
    });

    it('po upływie TTL wysyła nowe żądanie', () => {
      api.mapForHour('temperature_2m', hour).subscribe();
      http.expectOne((r) => r.url === MAP_URL).flush(points);

      vi.setSystemTime(Date.now() + CACHE_TTL_MS);
      api.mapForHour('temperature_2m', hour).subscribe();

      http.expectOne((r) => r.url === MAP_URL).flush(points);
    });

    it('inna zmienna albo godzina to inny wpis', () => {
      api.mapForHour('temperature_2m', hour).subscribe();
      http.expectOne((r) => r.url === MAP_URL).flush(points);

      api.mapForHour('pressure_msl', hour).subscribe();
      api.mapForHour('temperature_2m', new Date('2026-10-21T20:00:00Z')).subscribe();

      const requests = http.match((r) => r.url === MAP_URL);
      expect(requests.length).toBe(2);
      requests.forEach((r) => r.flush(points));
    });

    it('anulowane żądanie nie zostawia wpisu w cache', () => {
      const subscription = api.mapForHour('temperature_2m', hour).subscribe();
      const cancelled = http.expectOne((r) => r.url === MAP_URL);
      subscription.unsubscribe();
      expect(cancelled.cancelled).toBe(true);

      api.mapForHour('temperature_2m', hour).subscribe();

      http.expectOne((r) => r.url === MAP_URL).flush(points);
    });

    it('błąd HTTP nie trafia do cache', () => {
      api.mapForHour('temperature_2m', hour).subscribe({ error: () => undefined });
      http
        .expectOne((r) => r.url === MAP_URL)
        .flush('boom', { status: 500, statusText: 'Server Error' });

      api.mapForHour('temperature_2m', hour).subscribe();

      http.expectOne((r) => r.url === MAP_URL).flush(points);
    });

    it('sonda zakresu (singlePointSeries) też jest cache’owana', () => {
      const url = 'http://api.test/forecast';
      api.singlePointSeries('temperature_2m', 52, 19).subscribe();
      http
        .expectOne((r) => r.url === url)
        .flush({
          lat: 52,
          lon: 19,
          values: [{ valid_time: '2026-10-21T19:00:00+00:00', value: 10.5 }],
        });

      let result: unknown;
      api.singlePointSeries('temperature_2m', 52, 19).subscribe((s) => (result = s));

      http.expectNone((r) => r.url === url);
      expect(result).toEqual([{ validTime: new Date('2026-10-21T19:00:00Z'), value: 10.5 }]);
    });
  });
});
