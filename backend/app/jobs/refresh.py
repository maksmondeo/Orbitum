"""Odświeżenie (co 6 h): najnowsze runy wszystkich modeli -> mieszanka według mapy modeli -> tabela forecast."""
import numpy as np
import pandas as pd

from app import db
from app.config import MODELS
from app.weather import backtest, cache, model_map
from app.weather.s3 import latest_run


def latest_forecast(variable, model, slot):
    """Prognoza [lead 1…168, lat, lon] od `slot` z najnowszego opublikowanego runu (4 ostatnie runy trafiają do cache)."""
    runs = pd.date_range(end=latest_run(model), periods=4, freq="6h")
    cache.download_runs(variable, [model], runs)
    return backtest.simulate(variable, model, runs, pd.DatetimeIndex([slot]))[0]


def refresh():
    slot = pd.Timestamp.now("UTC").tz_localize(None).floor("h")
    for variable in MODELS:
        mm = model_map.load(variable)
        fc = np.stack([latest_forecast(variable, m, slot) for m in mm.attrs["models"]])
        db.write_forecast(variable, slot, model_map.blend(fc, mm, slot))
