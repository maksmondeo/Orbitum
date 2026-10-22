import { BacktestBucket } from './backtest-api';
import { orderModels, summarizeWinners } from './backtest-summary';

function bucket(fromHour: number, best: string, rmse: Record<string, number>): BacktestBucket {
  return { fromHour, toHour: fromHour + 5, best, rmse };
}

describe('summarizeWinners', () => {
  it('skleja kolejne przedziały z tym samym modelem', () => {
    const buckets = [
      bucket(1, 'ICON', { ICON: 1 }),
      bucket(7, 'AIFS', { AIFS: 1 }),
      bucket(13, 'AIFS', { AIFS: 1 }),
    ];

    expect(summarizeWinners(buckets)).toEqual([
      { fromHour: 1, toHour: 6, model: 'ICON' },
      { fromHour: 7, toHour: 18, model: 'AIFS' },
    ]);
  });

  it('A-B-A daje trzy linie', () => {
    const buckets = [
      bucket(1, 'A', { A: 1 }),
      bucket(7, 'B', { B: 1 }),
      bucket(13, 'A', { A: 1 }),
    ];

    expect(summarizeWinners(buckets).map((l) => l.model)).toEqual(['A', 'B', 'A']);
  });

  it('jeden przedział daje jedną linię', () => {
    expect(summarizeWinners([bucket(1, 'A', { A: 1 })])).toEqual([
      { fromHour: 1, toHour: 6, model: 'A' },
    ]);
  });

  it('pusta lista daje pustą listę', () => {
    expect(summarizeWinners([])).toEqual([]);
  });

  it('przedziały podane w złej kolejności układa rosnąco', () => {
    const buckets = [bucket(7, 'B', { B: 1 }), bucket(1, 'A', { A: 1 })];

    expect(summarizeWinners(buckets).map((l) => l.fromHour)).toEqual([1, 7]);
  });
});

describe('orderModels', () => {
  it('układa od najmniejszego średniego RMSE', () => {
    const buckets = [bucket(1, 'A', { A: 1, B: 3 }), bucket(7, 'A', { A: 2, B: 3 })];

    expect(orderModels(buckets)).toEqual(['A', 'B']);
  });

  it('model o krótkim horyzoncie nie wygrywa dzięki łatwym przedziałom', () => {
    // SHORT ma dane tylko w łatwym przedziale 1–6 h (2), LONG także w trudnym 7–12 h (1 i 5).
    // Średnia ze wszystkich przedziałów dałaby LONG 3 > SHORT 2, a we wspólnym przedziale LONG 1 < SHORT 2.
    const buckets = [
      bucket(1, 'LONG', { SHORT: 2, LONG: 1 }),
      bucket(7, 'LONG', { LONG: 5 }),
    ];

    expect(orderModels(buckets)).toEqual(['LONG', 'SHORT']);
  });

  it('remis rozstrzyga nazwa', () => {
    const buckets = [bucket(1, 'B', { B: 2, A: 2 })];

    expect(orderModels(buckets)).toEqual(['A', 'B']);
  });

  it('bez wspólnych przedziałów idzie alfabetycznie', () => {
    const buckets = [bucket(1, 'B', { B: 1 }), bucket(7, 'A', { A: 5 })];

    expect(orderModels(buckets)).toEqual(['A', 'B']);
  });

  it('pusta lista daje pustą listę', () => {
    expect(orderModels([])).toEqual([]);
  });
});
