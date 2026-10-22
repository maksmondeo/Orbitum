const HOUR_MS = 3_600_000;

const WARSAW_FORMAT = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DAY_FORMAT = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const CLOCK_FORMAT = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DATE_PARTS_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/**
 * Przy zmianie czasu na zimowy ta sama godzina na zegarze występuje dwa razy:
 * tylko wtedy zwracamy strefę (CEST dla pierwszego wystąpienia, CET dla drugiego).
 */
function ambiguousZone(date: Date): ' CEST' | ' CET' | '' {
  const clock = CLOCK_FORMAT.format(date);
  const t = date.getTime();

  if (CLOCK_FORMAT.format(new Date(t + HOUR_MS)) === clock) return ' CEST';
  if (CLOCK_FORMAT.format(new Date(t - HOUR_MS)) === clock) return ' CET';
  return '';
}

function datePart(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  return DATE_PARTS_FORMAT.formatToParts(date).find((p) => p.type === type)!.value;
}

/** Godzina w czasie polskim, np. „czw., 22.10, 03:00”; dwuznaczną godzinę opisuje strefa. */
export function formatHour(date: Date): string {
  return WARSAW_FORMAT.format(date) + ambiguousZone(date);
}

/** Dzień w czasie polskim, np. „czw. 22.10”. */
export function formatDay(date: Date): string {
  const parts = DAY_FORMAT.formatToParts(date);
  const text = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;

  return `${text('weekday')} ${text('day')}.${text('month')}`;
}

/** Pora doby w czasie polskim, np. „03:00”; dwuznaczną godzinę opisuje strefa („02:00 CEST”). */
export function formatClock(date: Date): string {
  return CLOCK_FORMAT.format(date) + ambiguousZone(date);
}

/** Doba polska jako `YYYY-MM-DD`. Klucz do grupowania godzin w dni. */
export function warsawDayKey(date: Date): string {
  return `${datePart(date, 'year')}-${datePart(date, 'month')}-${datePart(date, 'day')}`;
}

/** Godzina doby polskiej, 0–23. */
export function warsawHourOfDay(date: Date): number {
  return Number(datePart(date, 'hour'));
}
