import { Observable, of, throwError } from 'rxjs';
import { CACHE_TTL_MS, cachedRequest, CacheEntry } from './cached-request';

describe('cachedRequest', () => {
  let store: Map<string, CacheEntry<string>>;
  let calls: number;
  const request = () => {
    calls++;
    return of('dane');
  };
  const read = (obs: Observable<string>) => {
    let result: string | undefined;
    obs.subscribe((value) => (result = value));
    return result;
  };

  beforeEach(() => {
    store = new Map();
    calls = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('drugi odczyt w czasie TTL bierze dane z pamięci', () => {
    read(cachedRequest(store, 'a', request));

    vi.setSystemTime(Date.now() + CACHE_TTL_MS - 1);

    expect(read(cachedRequest(store, 'a', request))).toBe('dane');
    expect(calls).toBe(1);
  });

  it('po upływie TTL pyta ponownie', () => {
    read(cachedRequest(store, 'a', request));

    vi.setSystemTime(Date.now() + CACHE_TTL_MS);
    read(cachedRequest(store, 'a', request));

    expect(calls).toBe(2);
  });

  it('inny klucz to inny wpis', () => {
    read(cachedRequest(store, 'a', request));
    read(cachedRequest(store, 'b', request));

    expect(calls).toBe(2);
  });

  it('błąd nie zostawia wpisu', () => {
    cachedRequest(store, 'a', () => throwError(() => new Error('500'))).subscribe({
      error: () => undefined,
    });

    expect(store.size).toBe(0);
  });
});
