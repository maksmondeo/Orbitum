import { HourValue } from './forecast-types';

const HOUR_MS = 3_600_000;

/** Punkt siatki w środku Polski, o który pytamy, żeby poznać zakres godzin w bazie. */
export const PROBE_POINT = { lat: 52, lon: 19 } as const;

export interface HourRange {
  first: Date;
  last: Date;
  count: number;
}

/** Zakres godzin z serii sondy. Pusta seria (brak prognozy) daje `null`, a nie wyjątek. */
export function buildRange(series: HourValue[]): HourRange | null {
  if (series.length === 0) return null;

  const times = series.map((v) => v.validTime.getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);

  return {
    first: new Date(first),
    last: new Date(last),
    count: Math.round((last - first) / HOUR_MS) + 1,
  };
}

/** Indeks najbliższej pełnej godziny do `now`, przycięty do zakresu suwaka. */
export function startIndex(range: HourRange, now: Date): number {
  const index = Math.round((now.getTime() - range.first.getTime()) / HOUR_MS);
  return Math.min(Math.max(index, 0), range.count - 1);
}

/** Prognoza wygasła, gdy `now` jest po ostatniej godzinie zakresu. */
export function isExpired(range: HourRange, now: Date): boolean {
  return now.getTime() > range.last.getTime();
}
