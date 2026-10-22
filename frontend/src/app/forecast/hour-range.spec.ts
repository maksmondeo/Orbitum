import { HourValue } from './forecast-types';
import { buildRange, hourAt, isExpired, startIndex } from './hour-range';

/** Seria godzinowa od `start` (UTC), `count` godzin. */
function series(start: string, count: number): HourValue[] {
  const t0 = new Date(start).getTime();
  return Array.from({ length: count }, (_, i) => ({
    validTime: new Date(t0 + i * 3_600_000),
    value: i,
  }));
}

describe('hour-range', () => {
  const range = buildRange(series('2026-10-21T19:00:00Z', 168))!;

  describe('buildRange', () => {
    it('wyznacza pierwszą i ostatnią godzinę oraz liczbę kroków', () => {
      expect(range.first).toEqual(new Date('2026-10-21T19:00:00Z'));
      expect(range.last).toEqual(new Date('2026-10-28T18:00:00Z'));
      expect(range.count).toBe(168);
    });

    it('nie zakłada kolejności serii', () => {
      const shuffled = series('2026-10-21T19:00:00Z', 5).reverse();
      const r = buildRange(shuffled)!;
      expect(r.first).toEqual(new Date('2026-10-21T19:00:00Z'));
      expect(r.last).toEqual(new Date('2026-10-21T23:00:00Z'));
      expect(r.count).toBe(5);
    });

    it('seria z jednej godziny to zakres z jednym krokiem', () => {
      expect(buildRange(series('2026-10-21T19:00:00Z', 1))?.count).toBe(1);
    });

    it('pusta seria daje null (brak prognozy), a nie wyjątek', () => {
      expect(buildRange([])).toBeNull();
    });
  });

  describe('hourAt', () => {
    it('indeks 0 to pierwsza godzina, a ostatni indeks to ostatnia', () => {
      expect(hourAt(range, 0)).toEqual(new Date('2026-10-21T19:00:00Z'));
      expect(hourAt(range, 167)).toEqual(new Date('2026-10-28T18:00:00Z'));
    });
  });

  describe('startIndex', () => {
    it('w środku zakresu wybiera najbliższą pełną godzinę', () => {
      // 2026-10-22T10:20Z jest 15 h 20 min po początku, więc najbliższy krok to 15
      expect(startIndex(range, new Date('2026-10-22T10:20:00Z'))).toBe(15);
      expect(startIndex(range, new Date('2026-10-22T10:40:00Z'))).toBe(16);
    });

    it('dokładnie na pełnej godzinie zwraca jej indeks', () => {
      expect(startIndex(range, new Date('2026-10-22T19:00:00Z'))).toBe(24);
    });

    it('przed pierwszą godziną przycina do 0', () => {
      expect(startIndex(range, new Date('2026-10-20T00:00:00Z'))).toBe(0);
    });

    it('po ostatniej godzinie przycina do ostatniego indeksu', () => {
      expect(startIndex(range, new Date('2026-11-05T00:00:00Z'))).toBe(167);
    });
  });

  describe('isExpired', () => {
    it('nie wygasła przed i dokładnie o ostatniej godzinie', () => {
      expect(isExpired(range, new Date('2026-10-22T10:00:00Z'))).toBe(false);
      expect(isExpired(range, new Date('2026-10-28T18:00:00Z'))).toBe(false);
    });

    it('wygasła po ostatniej godzinie', () => {
      expect(isExpired(range, new Date('2026-10-28T18:00:01Z'))).toBe(true);
    });
  });
});
