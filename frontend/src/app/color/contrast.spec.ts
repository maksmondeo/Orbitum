import { contrastRatio, parseColor, relativeLuminance } from './contrast';

describe('contrastRatio', () => {
  it('czarny na białym to 21:1', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('ten sam kolor daje 1:1', () => {
    expect(contrastRatio('#767676', '#767676')).toBeCloseTo(1, 5);
  });

  it('#767676 na białym to ok. 4,54:1 (najjaśniejsza szarość spełniająca AA)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('kolejność argumentów nie ma znaczenia', () => {
    expect(contrastRatio('#fff', '#767676')).toBe(contrastRatio('#767676', '#fff'));
  });

  it('oklch daje czerń i biel jak hex', () => {
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 1);
  });
});

describe('parseColor', () => {
  it('oba zapisy oklch (liczba i procent z `none`) dają ten sam kolor', () => {
    const number = relativeLuminance(parseColor('oklch(0.205 0 0)'));
    const percent = relativeLuminance(parseColor('oklch(20.5% 0 none)'));
    expect(percent).toBeCloseTo(number, 10);
  });

  it('procent chromy liczy się względem 0,4', () => {
    const percent = parseColor('oklch(50% 50% 30)');
    const number = parseColor('oklch(0.5 0.2 30)');
    expect(percent.r).toBeCloseTo(number.r, 10);
    expect(percent.g).toBeCloseTo(number.g, 10);
    expect(percent.b).toBeCloseTo(number.b, 10);
  });

  it('hex w skróconej i pełnej formie to ten sam kolor', () => {
    expect(parseColor('#abc')).toEqual(parseColor('#aabbcc'));
  });

  it('rzuca wyjątek dla zapisu, którego nie zna, zamiast zgadywać', () => {
    expect(() => parseColor('red')).toThrow(/Nieobsługiwany/);
    expect(() => parseColor('rgb(0 0 0)')).toThrow(/Nieobsługiwany/);
    expect(() => parseColor('oklch(1 0 0 / 10%)')).toThrow(/Nieobsługiwany/);
    expect(() => parseColor('#12')).toThrow(/hex/);
  });
});
