"""Przeliczenie (co 7 dni): backtest z ostatnich WINDOW_DAYS dni -> nowa mapa modeli z wagami i biasem."""
import numpy as np
import pandas as pd
import xarray as xr

from app.config import BIAS_DAYS, BIAS_REFRESH_D, MODELS, WINDOW_DAYS
from app.weather import backtest, cache, model_map
from app.weather.s3 import meta


def recompute():
    m = meta("copernicus_era5")
    era5_end = pd.Timestamp(m["data_end_time"], unit="s")                       # pierwsza godzina bez ERA5
    lag = pd.Timedelta(seconds=m["last_run_availability_time"] - m["data_end_time"])
    runs = pd.date_range((era5_end - pd.Timedelta(days=WINDOW_DAYS)).floor("D"), era5_end - pd.Timedelta(hours=1), freq="6h")
    slots = runs[4:]                                                            # pierwsza doba runów to rozbieg
    decisions = pd.date_range((slots[0] + lag + pd.Timedelta(days=BIAS_DAYS + 1)).ceil("D"), slots[-1],
                              freq=f"{BIAS_REFRESH_D}D")
    w = backtest.decay(slots, slots[-1])
    for variable, models in MODELS.items():
        cache.download_runs(variable, models, runs)
        fc = backtest.forecasts(variable, models, runs, slots)
        obs = backtest.observations(cache.era5(variable, slots[0], era5_end), fc)
        sums = backtest.error_sums(fc, obs)
        gain = backtest.gain_by_day(backtest.walk_forward(fc, sums, decisions, lag), fc, obs)
        max_lead = 24 * (gain > 0).cumprod("lead").sum("lead")                  # korekta do ostatniego dnia, w którym pomaga
        fcc = backtest.walk_forward(fc, sums, decisions, lag, max_lead.values)
        bias_end = era5_end.floor("D")
        model_map.save(variable, xr.Dataset(
            {"best_model": backtest.weighted_rmse(fc, obs, w).fillna(np.inf).argmin("model").astype("int8"),
             "rmse": backtest.weighted_rmse(fc, obs, w, min_coverage=0).astype("float32"),
             "rmse_corrected": backtest.weighted_rmse(fcc, obs, w, min_coverage=0).astype("float32"),
             "bias": (("model", "hour", "lat", "lon"), backtest.bias_at(sums, bias_end).astype("float32")),
             "bias_max_lead": max_lead.astype("int16")},
            coords={"hour": np.arange(24)},
            attrs={"models": list(models), "variable": variable, "slots": f"{slots[0]} – {slots[-1]}",
                   "bias_window": f"{bias_end - pd.Timedelta(days=BIAS_DAYS)} – {bias_end}"}).drop_vars("model"))
