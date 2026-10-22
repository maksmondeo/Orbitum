export type Variable = 'temperature_2m' | 'pressure_msl';

/** Jeden węzeł siatki prognozy (`/forecast/map`). */
export interface GridPoint {
  lat: number;
  lon: number;
  value: number;
}

/** Wartość prognozy w jednej godzinie (`/forecast`). */
export interface HourValue {
  validTime: Date;
  value: number;
}

/** Odpowiedź `/forecast`: godziny razem z węzłem siatki, do którego backend przyciągnął punkt. */
export interface PointForecast {
  lat: number;
  lon: number;
  values: HourValue[];
}
