import { returnUrlFor, safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('przepuszcza ścieżki wewnątrz aplikacji', () => {
    expect(safeReturnUrl('/konto')).toBe('/konto');
    expect(safeReturnUrl('/?lat=51.25&lon=22.5')).toBe('/?lat=51.25&lon=22.5');
  });

  it('zamienia obce adresy na mapę', () => {
    expect(safeReturnUrl('//evil.com')).toBe('/');
    expect(safeReturnUrl('/\\evil.com')).toBe('/');
    expect(safeReturnUrl('https://evil.com')).toBe('/');
  });

  it('zamienia strony logowania i rejestracji na mapę', () => {
    expect(safeReturnUrl('/logowanie?powrot=%2Fkonto')).toBe('/');
    expect(safeReturnUrl('/rejestracja')).toBe('/');
  });

  it('zamienia brak adresu na mapę', () => {
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl('')).toBe('/');
  });
});

describe('returnUrlFor', () => {
  it('na zwykłej stronie wraca na nią samą, razem z punktem', () => {
    expect(returnUrlFor('/konto')).toBe('/konto');
    expect(returnUrlFor('/?lat=51.25&lon=22.5')).toBe('/?lat=51.25&lon=22.5');
  });

  it('na mapie bez punktu nie dodaje nic', () => {
    expect(returnUrlFor('/')).toBeNull();
  });

  it('na stronie logowania podaje dalej jej własny powrot', () => {
    expect(returnUrlFor('/logowanie?powrot=%2Fkonto')).toBe('/konto');
    expect(returnUrlFor('/logowanie')).toBeNull();
  });
});
