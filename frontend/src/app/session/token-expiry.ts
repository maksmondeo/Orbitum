/**
 * Czy token ma jeszcze ważny `exp`. Podpisu nie sprawdza: robi to backend. Tu chodzi tylko o to,
 * żeby nie wpuszczać na chronioną stronę z tokenem, o którym już wiadomo, że wygasł.
 */
export function isTokenValid(token: string, now: Date): boolean {
  const exp = readExp(token);
  return exp !== null && exp * 1000 > now.getTime();
}

/** `exp` (sekundy) z drugiej części JWT albo `null`, gdy token jest uszkodzony. */
function readExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload: unknown = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload === 'object' && payload !== null && 'exp' in payload) {
      return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
    }
    return null;
  } catch {
    return null;
  }
}
