import { defer, Observable, of, tap } from 'rxjs';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/** Jak długo odpowiedź jest ważna. Sprawdzana przy odczycie, bez timerów. */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Świeży wpis z pamięci albo żądanie do sieci. Wpis powstaje dopiero po odpowiedzi (`tap`
 * reaguje na wartość), więc żądanie anulowane przez `unsubscribe` ani błąd HTTP
 * nie zostawiają śladu w cache.
 */
export function cachedRequest<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  request: () => Observable<T>,
): Observable<T> {
  return defer(() => {
    const hit = store.get(key);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return of(hit.data);

    return request().pipe(tap((data) => store.set(key, { data, fetchedAt: Date.now() })));
  });
}
