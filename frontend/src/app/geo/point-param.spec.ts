import { parsePoint, toQueryParams } from './point-param';

const params = (query: Record<string, string>) => new URLSearchParams(query);

describe('parsePoint', () => {
  it('poprawna para daje punkt', () => {
    expect(parsePoint(params({ lat: '51.2465', lon: '22.5684' }))).toEqual({
      lat: 51.2465,
      lon: 22.5684,
    });
  });

  it('brak jednego parametru daje null', () => {
    expect(parsePoint(params({ lat: '51.2465' }))).toBeNull();
  });

  it('tekst zamiast liczby daje null', () => {
    expect(parsePoint(params({ lat: 'abc', lon: '22.5' }))).toBeNull();
  });

  it('punkt daleko poza Polską daje null', () => {
    expect(parsePoint(params({ lat: '0', lon: '0' }))).toBeNull();
  });

  it('punkt tuż za granicą, ale w prostokącie siatki, daje null', () => {
    expect(parsePoint(params({ lat: '50.1', lon: '14.4' }))).toBeNull();
  });
});

describe('toQueryParams', () => {
  it('zaokrągla do 4 miejsc po przecinku', () => {
    expect(toQueryParams({ lat: 51.246512345, lon: 22.5 })).toEqual({
      lat: '51.2465',
      lon: '22.5000',
    });
  });
});
