import { HourValue } from '../forecast/forecast-types';
import { summarizeDays } from './daily-summary';

const at = (iso: string, value: number): HourValue => ({ validTime: new Date(iso), value });

/** `count` kolejnych godzin od `startIso`, wszystkie z wartością 1. */
function hoursFrom(startIso: string, count: number): HourValue[] {
  const start = new Date(startIso).getTime();
  return Array.from({ length: count }, (_, i) => at(new Date(start + i * 3_600_000).toISOString(), 1));
}

const NOW = new Date('2026-10-22T00:00:00Z');

describe('summarizeDays', () => {
  it('liczy min i max osobno dla każdego dnia, także z nieposortowanego wejścia', () => {
    const days = summarizeDays(
      [
        at('2026-10-23T10:00:00Z', 3),
        at('2026-10-22T12:00:00Z', 9),
        at('2026-10-22T10:00:00Z', 5),
      ],
      NOW,
    );

    expect(days.map((d) => [d.key, d.min, d.max])).toEqual([
      ['2026-10-22', 5, 9],
      ['2026-10-23', 3, 3],
    ]);
  });

  it('dzień z jedną godziną w środku doby jest niepełny z obu stron', () => {
    const [day] = summarizeDays([at('2026-10-22T10:00:00Z', 5)], NOW);

    expect(day.startsLate).toBe(true);
    expect(day.endsEarly).toBe(true);
  });

  it('pełna doba (00–23) nie ma flag', () => {
    const [day] = summarizeDays(hoursFrom('2026-10-22T22:00:00Z', 24), NOW);

    expect(day.key).toBe('2026-10-23');
    expect(day.startsLate).toBe(false);
    expect(day.endsEarly).toBe(false);
  });

  it('odcina godziny sprzed najbliższej pełnej godziny względem teraz', () => {
    const values = [
      at('2026-10-22T08:00:00Z', 1),
      at('2026-10-22T09:00:00Z', 2),
      at('2026-10-22T10:00:00Z', 3),
    ];

    const before = summarizeDays(values, new Date('2026-10-22T09:20:00Z'));
    const after = summarizeDays(values, new Date('2026-10-22T09:40:00Z'));

    expect(before[0].hours.map((h) => h.value)).toEqual([2, 3]);
    expect(after[0].hours.map((h) => h.value)).toEqual([3]);
  });

  it('doba zmiany czasu 25.10 ma 25 godzin w jednym dniu', () => {
    const days = summarizeDays(hoursFrom('2026-10-24T22:00:00Z', 25), NOW);

    expect(days.length).toBe(1);
    expect(days[0].key).toBe('2026-10-25');
    expect(days[0].hours.length).toBe(25);
  });

  it('pusta lista i teraz po ostatniej godzinie dają []', () => {
    expect(summarizeDays([], NOW)).toEqual([]);
    expect(summarizeDays([at('2026-10-22T10:00:00Z', 5)], new Date('2026-10-22T11:00:00Z'))).toEqual([]);
  });
});
