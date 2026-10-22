import { isInPoland } from './poland-mask';

describe('isInPoland', () => {
  it('Warszawa i Lublin są w Polsce', () => {
    expect(isInPoland(21.01, 52.23)).toBe(true);
    expect(isInPoland(22.57, 51.25)).toBe(true);
  });

  it('Brześć na Białorusi, Berlin i Praga są poza Polską', () => {
    expect(isInPoland(23.7, 52.1)).toBe(false);
    expect(isInPoland(13.4, 52.5)).toBe(false);
    expect(isInPoland(14.4, 50.1)).toBe(false);
  });
});
