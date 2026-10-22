import { HourValue } from '../forecast/forecast-types';
import { warsawDayKey, warsawHourOfDay } from '../forecast/warsaw-time';

const HOUR_MS = 3_600_000;

/** Jeden dzień polski prognozy: min i max z godzin, które jeszcze przed nami. */
export interface DaySummary {
  key: string;
  first: Date;
  last: Date;
  min: number;
  max: number;
  hours: HourValue[];
  /** Pierwsza godzina dnia (lokalnie) to nie 00. */
  startsLate: boolean;
  /** Ostatnia godzina dnia (lokalnie) to nie 23. */
  endsEarly: boolean;
}

/**
 * Dzieli godziny na doby polskie i odcina te sprzed najbliższej pełnej godziny względem `now`
 * (ta sama reguła zaokrąglania co start suwaka). Brak godzin od `now` daje `[]`.
 */
export function summarizeDays(values: HourValue[], now: Date): DaySummary[] {
  const cutoff = Math.round(now.getTime() / HOUR_MS) * HOUR_MS;
  const upcoming = values
    .filter((v) => v.validTime.getTime() >= cutoff)
    .sort((a, b) => a.validTime.getTime() - b.validTime.getTime());

  const byDay = new Map<string, HourValue[]>();
  for (const v of upcoming) {
    const key = warsawDayKey(v.validTime);
    byDay.set(key, [...(byDay.get(key) ?? []), v]);
  }

  return [...byDay].map(([key, hours]) => {
    const numbers = hours.map((h) => h.value);
    const first = hours[0].validTime;
    const last = hours[hours.length - 1].validTime;

    return {
      key,
      first,
      last,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      hours,
      startsLate: warsawHourOfDay(first) !== 0,
      endsEarly: warsawHourOfDay(last) !== 23,
    };
  });
}
