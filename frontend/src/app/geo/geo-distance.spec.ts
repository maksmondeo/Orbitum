import { distanceKm } from './geo-distance';

describe('distanceKm', () => {
  it('ten sam punkt daje 0', () => {
    expect(distanceKm({ lat: 51.25, lon: 22.5 }, { lat: 51.25, lon: 22.5 })).toBe(0);
  });

  it('centrum Lublina do węzła siatki to ok. 4,8 km', () => {
    const km = distanceKm({ lat: 51.2465, lon: 22.5684 }, { lat: 51.25, lon: 22.5 });
    expect(km).toBeCloseTo(4.8, 1);
  });

  it('1° szerokości to ok. 111 km', () => {
    const km = distanceKm({ lat: 50, lon: 20 }, { lat: 51, lon: 20 });
    expect(km).toBeCloseTo(111, 0);
  });
});
