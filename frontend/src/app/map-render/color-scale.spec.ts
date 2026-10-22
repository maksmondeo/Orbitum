import { ColorScale, Rgb, SCALES, colorAt } from './color-scale';

/** Suma różnic kanałów R, G, B: prosta miara, czy dwa kolory wyglądają inaczej. */
function colorDistance(a: Rgb, b: Rgb): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

describe('colorAt', () => {
  const scale: ColorScale = {
    label: 'Test',
    unit: 'u',
    stops: [
      { value: 0, color: [0, 0, 0] },
      { value: 10, color: [100, 200, 50] },
      { value: 20, color: [200, 200, 250] },
    ],
  };

  it('wartość równa stopniowi zwraca dokładnie jego kolor', () => {
    expect(colorAt(scale, 0)).toEqual([0, 0, 0, 255]);
    expect(colorAt(scale, 10)).toEqual([100, 200, 50, 255]);
    expect(colorAt(scale, 20)).toEqual([200, 200, 250, 255]);
  });

  it('środek między stopniami to średnia kolorów', () => {
    expect(colorAt(scale, 5)).toEqual([50, 100, 25, 255]);
    expect(colorAt(scale, 15)).toEqual([150, 200, 150, 255]);
  });

  it('interpoluje proporcjonalnie do odległości od stopnia', () => {
    expect(colorAt(scale, 2.5)).toEqual([25, 50, 13, 255]);
  });

  it('poza zakresem przycina do skrajnych kolorów', () => {
    expect(colorAt(scale, -100)).toEqual([0, 0, 0, 255]);
    expect(colorAt(scale, 999)).toEqual([200, 200, 250, 255]);
    expect(colorAt(scale, Infinity)).toEqual([200, 200, 250, 255]);
  });

  it('NaN daje kolor przezroczysty', () => {
    expect(colorAt(scale, NaN)[3]).toBe(0);
  });
});

describe('SCALES', () => {
  const all = Object.entries(SCALES);

  it.each(all)('%s: stopnie są ściśle rosnące', (_, scale) => {
    scale.stops.forEach((stop, i) => {
      if (i > 0) expect(stop.value).toBeGreaterThan(scale.stops[i - 1].value);
    });
  });

  it('0 °C jest stopniem skali temperatury', () => {
    expect(SCALES.temperature_2m.stops.map((s) => s.value)).toContain(0);
  });

  it.each(all)('%s: sąsiednie stopnie wyraźnie różnią się kolorem', (_, scale) => {
    scale.stops.forEach((stop, i) => {
      if (i > 0) {
        expect(colorDistance(stop.color, scale.stops[i - 1].color)).toBeGreaterThanOrEqual(40);
      }
    });
  });
});
