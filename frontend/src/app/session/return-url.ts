/** Parametr adresu, w którym strona logowania dostaje adres powrotu: `/logowanie?powrot=%2Fkonto`. */
export const RETURN_PARAM = 'powrot';

const AUTH_PAGES = ['/logowanie', '/rejestracja'];

function isAuthPage(url: string): boolean {
  return AUTH_PAGES.some((page) => url.startsWith(page));
}

/**
 * Dokąd wrócić po zalogowaniu. Przyjmuje tylko ścieżkę wewnątrz aplikacji (jeden `/` na początku),
 * bo adres pochodzi z paska przeglądarki i ktoś może w nim podstawić obcą stronę. Strony logowania
 * i rejestracji też odpadają, żeby nie wrócić na nie w pętli. Wszystko inne to mapa.
 */
export function safeReturnUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return isAuthPage(raw) ? '/' : raw;
}

/**
 * Jaki `powrot` ma dostać link do logowania albo rejestracji wysłany z bieżącej strony.
 * Zwykła strona wraca na siebie (razem z `?lat=&lon=`), a strona logowania podaje dalej własny `powrot`.
 * Mapa bez punktu to `null`: nie ma po co zaśmiecać adresu.
 */
export function returnUrlFor(currentUrl: string): string | null {
  const target = isAuthPage(currentUrl)
    ? safeReturnUrl(new URL(currentUrl, 'http://orbitum').searchParams.get(RETURN_PARAM))
    : currentUrl;
  return target === '/' ? null : target;
}
