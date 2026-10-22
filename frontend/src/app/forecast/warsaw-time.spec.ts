import { formatHour } from './warsaw-time';

describe('formatHour', () => {
  it('formatuje godzinę letnią (UTC+2)', () => {
    expect(formatHour(new Date('2026-10-22T01:00:00Z'))).toBe('czw., 22.10, 03:00');
  });

  it('formatuje godzinę zimową (UTC+1)', () => {
    expect(formatHour(new Date('2026-12-15T12:00:00Z'))).toBe('wt., 15.12, 13:00');
  });

  it('zmiana czasu 25.10: 02:00 występuje dwa razy i dostaje dopisek strefy', () => {
    expect(formatHour(new Date('2026-10-25T00:00:00Z'))).toBe('niedz., 25.10, 02:00 CEST');
    expect(formatHour(new Date('2026-10-25T01:00:00Z'))).toBe('niedz., 25.10, 02:00 CET');
  });

  it('godziny sąsiadujące z dwuznaczną nie mają dopiska', () => {
    expect(formatHour(new Date('2026-10-24T23:00:00Z'))).toBe('niedz., 25.10, 01:00');
    expect(formatHour(new Date('2026-10-25T02:00:00Z'))).toBe('niedz., 25.10, 03:00');
  });

  it('dwa kroki 02:00 różnią się etykietą', () => {
    const a = formatHour(new Date('2026-10-25T00:00:00Z'));
    const b = formatHour(new Date('2026-10-25T01:00:00Z'));
    expect(a).not.toBe(b);
  });

  it('używa polskich skrótów dni tygodnia', () => {
    const days = [19, 20, 21, 22, 23, 24, 25].map(
      (d) => formatHour(new Date(Date.UTC(2026, 9, d, 12))).split(',')[0],
    );
    expect(days).toEqual(['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.']);
  });

  it('wiosenna zmiana czasu: brakująca godzina nie powoduje dopisków', () => {
    // 2026-03-29: 02:00 CET → 03:00 CEST (o 01:00 UTC)
    expect(formatHour(new Date('2026-03-29T00:00:00Z'))).toBe('niedz., 29.03, 01:00');
    expect(formatHour(new Date('2026-03-29T01:00:00Z'))).toBe('niedz., 29.03, 03:00');
  });
});
