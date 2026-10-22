import { BacktestBucket } from './backtest-api';

export interface WinnerLine {
  fromHour: number;
  toHour: number;
  model: string;
}

/** Kolejne przedziały z tym samym `best` sklejone w jedną linię („1–6 h: DWD ICON”). */
export function summarizeWinners(buckets: BacktestBucket[]): WinnerLine[] {
  const sorted = [...buckets].sort((a, b) => a.fromHour - b.fromHour);
  const lines: WinnerLine[] = [];

  for (const bucket of sorted) {
    const last = lines.at(-1);
    if (last?.model === bucket.best) {
      last.toHour = bucket.toHour;
    } else {
      lines.push({ fromHour: bucket.fromHour, toHour: bucket.toHour, model: bucket.best });
    }
  }
  return lines;
}

/**
 * Kolejność kolumn tabeli: od najmniejszego średniego RMSE. Średnią liczymy tylko z przedziałów,
 * w których są dane wszystkich modeli, bo modele o krótkim horyzoncie mają wyłącznie łatwe,
 * bliskie przedziały i wygrałyby przez to z modelami, które liczą też trudne, dalekie.
 */
export function orderModels(buckets: BacktestBucket[]): string[] {
  const models = [...new Set(buckets.flatMap((b) => Object.keys(b.rmse)))];
  const common = buckets.filter((b) => models.every((m) => m in b.rmse));

  if (common.length === 0) {
    return models.sort((a, b) => a.localeCompare(b));
  }

  const mean = (model: string) => common.reduce((sum, b) => sum + b.rmse[model], 0) / common.length;
  return models.sort((a, b) => mean(a) - mean(b) || a.localeCompare(b));
}
