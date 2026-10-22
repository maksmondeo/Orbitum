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

function wallClock(date: Date): { weekday: string; text: string } {
  const p = Object.fromEntries(WARSAW_FORMAT.formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: p['weekday'], text: `${p['day']}.${p['month']}, ${p['hour']}:${p['minute']}` };
}

/**
 * Godzina w czasie polskim, np. „czw. 22.10, 03:00”.
 * Przy zmianie czasu na zimowy ta sama godzina na zegarze występuje dwa razy:
 * tylko wtedy dopisujemy strefę (CEST dla pierwszego wystąpienia, CET dla drugiego).
 */
export function formatHour(date: Date): string {
  const { weekday, text } = wallClock(date);
  const label = `${weekday} ${text}`;
  const t = date.getTime();

  if (wallClock(new Date(t + HOUR_MS)).text === text) return `${label} CEST`;
  if (wallClock(new Date(t - HOUR_MS)).text === text) return `${label} CET`;
  return label;
}
