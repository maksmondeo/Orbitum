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

/**
 * Godzina w czasie polskim, np. „czw., 22.10, 03:00”.
 * Przy zmianie czasu na zimowy ta sama godzina na zegarze występuje dwa razy:
 * tylko wtedy dopisujemy strefę (CEST dla pierwszego wystąpienia, CET dla drugiego).
 */
export function formatHour(date: Date): string {
  const label = WARSAW_FORMAT.format(date);
  const t = date.getTime();

  if (WARSAW_FORMAT.format(new Date(t + HOUR_MS)) === label) return `${label} CEST`;
  if (WARSAW_FORMAT.format(new Date(t - HOUR_MS)) === label) return `${label} CET`;
  return label;
}
