import { isTokenValid } from './token-expiry';

/** Składa token w kształcie JWT. Podpis jest dowolny, bo funkcja go nie sprawdza. */
function tokenWith(payload: object): string {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe('isTokenValid', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  const nowSeconds = now.getTime() / 1000;

  it('przyjmuje token, który wygasa w przyszłości', () => {
    expect(isTokenValid(tokenWith({ exp: nowSeconds + 60 }), now)).toBe(true);
  });

  it('odrzuca token, który już wygasł', () => {
    expect(isTokenValid(tokenWith({ exp: nowSeconds - 60 }), now)).toBe(false);
  });

  it('odrzuca token wygasający dokładnie teraz', () => {
    expect(isTokenValid(tokenWith({ exp: nowSeconds }), now)).toBe(false);
  });

  it('odrzuca token bez `exp`', () => {
    expect(isTokenValid(tokenWith({ sub: '1' }), now)).toBe(false);
  });

  it('odrzuca uszkodzony i pusty token', () => {
    expect(isTokenValid('abc', now)).toBe(false);
    expect(isTokenValid('a.b.c', now)).toBe(false);
    expect(isTokenValid('', now)).toBe(false);
  });
});
