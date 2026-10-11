"""Odczyt prognozy i rankingu modeli."""
from datetime import datetime
from typing import Literal

import numpy as np
from fastapi import APIRouter

from app import db
from app.config import BUCKET_H, LAT, LON, MODELS
from app.weather import model_map

router = APIRouter(tags=["forecast"])
Variable = Literal["temperature_2m", "pressure_msl"]


def nearest(lat, lon):
    """Najbliższy punkt siatki 0.25°."""
    return float(LAT[np.abs(LAT - lat).argmin()]), float(LON[np.abs(LON - lon).argmin()])


@router.get("/forecast")
def forecast(variable: Variable, lat: float, lon: float):
    """Prognoza godzinowa w najbliższym punkcie siatki."""
    lat, lon = nearest(lat, lon)
    return {"lat": lat, "lon": lon, "values": db.forecast_point(variable, lat, lon)}


@router.get("/forecast/map")
def forecast_map(variable: Variable, valid_time: datetime):
    """Prognoza w całej siatce dla jednej godziny."""
    return db.forecast_map(variable, valid_time)


@router.get("/models")
def models(variable: Variable, lat: float, lon: float):
    """Ranking modeli w najbliższym punkcie siatki: najlepszy model i RMSE każdego modelu per bucket leadu."""
    lat, lon = nearest(lat, lon)
    mm = model_map.load(variable).sel(lat=lat, lon=lon)
    names = [MODELS[variable].get(m, m) for m in mm.attrs["models"]]
    return {"lat": lat, "lon": lon, "buckets": [
        {"lead_h": f"{b}-{b + BUCKET_H - 1}", "best": names[int(mm.best_model[k])],
         "rmse": {n: round(float(r), 3) for r, n in sorted((r, n) for r, n in zip(mm.rmse.values[:, k], names)
                                                            if np.isfinite(r))}}
        for k, b in enumerate(mm.bucket.values)]}
