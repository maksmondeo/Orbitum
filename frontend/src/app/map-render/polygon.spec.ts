import { isInside, Ring } from './polygon';

const square: Ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

// Litera U: dwa pionowe słupki połączone na dole, a pośrodku wcięcie od góry.
const letterU: Ring = [
  [0, 0],
  [30, 0],
  [30, 30],
  [20, 30],
  [20, 10],
  [10, 10],
  [10, 30],
  [0, 30],
];

describe('isInside', () => {
  it('punkt w środku kwadratu jest wewnątrz', () => {
    expect(isInside([5, 5], square)).toBe(true);
  });

  it('punkt tuż obok kwadratu jest na zewnątrz', () => {
    expect(isInside([11, 5], square)).toBe(false);
    expect(isInside([5, -1], square)).toBe(false);
  });

  it('punkt daleko poza kwadratem jest na zewnątrz', () => {
    expect(isInside([500, -300], square)).toBe(false);
  });

  it('w wielokącie wklęsłym wcięcie jest na zewnątrz, a słupki wewnątrz', () => {
    expect(isInside([15, 20], letterU)).toBe(false);
    expect(isInside([5, 20], letterU)).toBe(true);
    expect(isInside([25, 20], letterU)).toBe(true);
    expect(isInside([15, 5], letterU)).toBe(true);
  });
});
