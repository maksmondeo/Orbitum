import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ForecastApi } from '../forecast/forecast-api';
import { GridPoint, HourValue, Variable } from '../forecast/forecast-types';
import { ColorScale } from '../map-render/color-scale';
import ForecastMap from './forecast-map';
import { MapCanvas } from './map-canvas';

/** Okno throttlingu strony (300 ms) z zapasem na pewne jego domknięcie. */
const THROTTLE_WINDOW = 301;

/** Zamiast prawdziwej mapy (WebGL nie działa w jsdom): zapamiętuje tylko to, co dostała. */
@Component({ selector: 'app-map-canvas', template: '' })
class StubMapCanvas {
  readonly points = input<GridPoint[] | null>(null);
  readonly scale = input.required<ColorScale>();
}

const DAY: HourValue[] = Array.from({ length: 24 }, (_, i) => ({
  validTime: new Date(Date.UTC(2026, 9, 22, i)),
  value: 0,
}));

/**
 * Sonda domyślnie zwraca 24 godziny od północy UTC (test może ją podmienić).
 * Każde pytanie o mapę czeka, aż test odpowie.
 */
class FakeApi {
  readonly calls: { variable: Variable; validTime: Date; response: Subject<GridPoint[]> }[] = [];
  probe: Observable<HourValue[]> = of(DAY);

  singlePointSeries() {
    return this.probe;
  }

  mapForHour(variable: Variable, validTime: Date) {
    const response = new Subject<GridPoint[]>();
    this.calls.push({ variable, validTime, response });
    return response;
  }
}

describe('ForecastMap', () => {
  let api: FakeApi;
  let fixture: ComponentFixture<ForecastMap>;

  const hourOf = (call: { validTime: Date }) => call.validTime.getUTCHours();
  const lastCall = () => api.calls[api.calls.length - 1];

  /** Przesuwa czas i daje Angularowi wykonać efekty (to one budzą strumień żądań). */
  function wait(ms: number) {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  function moveSliderTo(index: number) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=range]');
    input.value = String(index);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Otwiera stronę. Test może wcześniej zmienić `api.probe` albo czas. */
  function openPage() {
    fixture = TestBed.createComponent(ForecastMap);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  /** Komunikat nad mapą (stan ładowania, błędu, braku prognozy albo wygasłej prognozy). */
  function message(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role=status], [role=alert]');
  }

  beforeEach(() => {
    // „Teraz” to 05:10 UTC, więc suwak startuje na godzinie 5.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-22T05:10:00Z'));
    // Błędy HTTP są w tych testach zamierzone, więc nie zaśmiecają wyniku.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    api = new FakeApi();
    TestBed.configureTestingModule({ providers: [{ provide: ForecastApi, useValue: api }] });
    TestBed.overrideComponent(ForecastMap, {
      remove: { imports: [MapCanvas] },
      add: { imports: [StubMapCanvas] },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('suwak i zmienna', () => {
    beforeEach(openPage);

    it('pierwsze żądanie idzie od razu, na godzinę z „teraz”', () => {
      expect(api.calls.length).toBe(1);
      expect(hourOf(lastCall())).toBe(5);
      expect(lastCall().variable).toBe('temperature_2m');
    });

    it('ciągłe przesuwanie suwaka daje kilka żądań, a nie jedno na każdy krok', () => {
      for (let hour = 6; hour <= 15; hour++) {
        moveSliderTo(hour);
        wait(50);
      }
      wait(THROTTLE_WINDOW);

      expect(api.calls.length).toBeLessThanOrEqual(4);
      expect(hourOf(lastCall())).toBe(15);
    });

    it('spóźniona odpowiedź na starsze żądanie nie nadpisuje nowszej', () => {
      moveSliderTo(8);
      wait(THROTTLE_WINDOW);
      moveSliderTo(9);
      wait(THROTTLE_WINDOW);
      const [, older, newer] = api.calls;
      expect(hourOf(older)).toBe(8);
      expect(hourOf(newer)).toBe(9);

      newer.response.next([{ lat: 52, lon: 19, value: 9 }]);
      older.response.next([{ lat: 52, lon: 19, value: 8 }]);
      fixture.detectChanges();

      expect(shownPoints()).toEqual([{ lat: 52, lon: 19, value: 9 }]);
    });

    it('zmiana zmiennej wysyła nowe żądanie z nową zmienną', () => {
      const pressure: HTMLInputElement = fixture.nativeElement.querySelector('input[value=pressure_msl]');
      pressure.click();
      wait(THROTTLE_WINDOW);

      expect(lastCall().variable).toBe('pressure_msl');
      expect(hourOf(lastCall())).toBe(5);
    });
  });

  describe('stany', () => {
    it('do czasu odpowiedzi pokazuje ładowanie', () => {
      openPage();

      expect(message()?.textContent).toContain('Ładuję');
    });

    it('pusta lista z mapy daje komunikat o braku prognozy', () => {
      openPage();
      lastCall().response.next([]);
      fixture.detectChanges();

      expect(message()?.textContent).toContain('Brak prognozy');
    });

    it('pusta sonda daje komunikat o braku prognozy i chowa suwak', () => {
      api.probe = of([]);
      openPage();

      expect(message()?.textContent).toContain('Brak prognozy');
      expect(fixture.nativeElement.querySelector('input[type=range]')).toBeNull();
    });

    it('błąd HTTP daje komunikat z przyciskiem, a ponowienie przywraca mapę', () => {
      openPage();
      lastCall().response.error(new Error('500'));
      fixture.detectChanges();

      expect(message()?.getAttribute('role')).toBe('alert');
      const retry: HTMLButtonElement = message()!.querySelector('button')!;
      expect(retry.textContent).toContain('Spróbuj ponownie');

      retry.click();
      wait(THROTTLE_WINDOW);
      expect(api.calls.length).toBe(2);
      expect(message()?.textContent).toContain('Ładuję');

      lastCall().response.next([{ lat: 52, lon: 19, value: 1 }]);
      fixture.detectChanges();
      expect(message()).toBeNull();
    });

    it('błąd sondy też daje komunikat z przyciskiem', () => {
      api.probe = throwError(() => new Error('500'));
      openPage();

      expect(message()?.textContent).toContain('Nie udało się');
      expect(message()?.querySelector('button')).not.toBeNull();
    });

    it('po ostatniej godzinie prognozy pokazuje „wygasła” i ostatnią godzinę na suwaku', () => {
      vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
      openPage();
      lastCall().response.next([{ lat: 52, lon: 19, value: 1 }]);
      fixture.detectChanges();

      expect(message()?.textContent).toContain('wygasła');
      expect(hourOf(lastCall())).toBe(23);
    });
  });

  function shownPoints() {
    return fixture.debugElement.query(By.directive(StubMapCanvas)).componentInstance.points();
  }
});
