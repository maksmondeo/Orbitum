import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../api/api-url';
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
      api.mapForHour('pressure_msl', new Date('2026-10-21T19:00:00Z')).subscribe((p) => (result = p));

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

      http.expectOne((r) => r.url === 'http://api.test/forecast').flush({
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
      api.singlePointSeries('temperature_2m', 52, 19).subscribe({ error: (e) => (status = e.status) });

      http
        .expectOne((r) => r.url === 'http://api.test/forecast')
        .flush('nope', { status: 422, statusText: 'Unprocessable' });
      expect(status).toBe(422);
    });
  });
});
