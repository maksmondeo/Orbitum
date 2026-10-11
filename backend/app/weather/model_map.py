"""Mapa modeli na dysku (model_map_{zmienna}.zarr) i mieszanka modeli liczona z jej wag."""
import shutil

import numpy as np
import xarray as xr

from app.config import BUCKET_H, DATA, MAX_LEAD


def path(variable):
    return DATA / f"model_map_{variable}.zarr"


def save(variable, ds):
    """Zapis przez katalog tymczasowy, żeby odświeżenie nie trafiło na w połowie zapisaną mapę."""
    tmp = path(variable).with_suffix(".tmp")
    ds.to_zarr(tmp, mode="w", consolidated=False)
    shutil.rmtree(path(variable), ignore_errors=True)
    tmp.rename(path(variable))


def load(variable):
    return xr.open_zarr(path(variable), consolidated=False).load()


def blend(fc, mm, slot):
    """Mieszanka [lead 1…168, lat, lon] z prognoz modeli fc [model, lead, lat, lon] w kolejności mm.attrs["models"].
    Od prognozy modelu odejmujemy bias (do bias_max_lead), a wagi to 1 / rmse_corrected² z danego punktu i bucketu.
    Liczą się tylko modele, które mają prognozę."""
    lead = np.arange(1, MAX_LEAD + 1)
    on = lead[None, :, None, None] <= mm.bias_max_lead.values[:, None, None, None]
    fcc = fc - mm.bias.values[:, (slot.hour + lead) % 24] * on
    w = np.where(np.isfinite(fcc), np.nan_to_num(mm.rmse_corrected.values[:, (lead - 1) // BUCKET_H] ** -2), 0)
    with np.errstate(invalid="ignore"):                         # 0 / 0 tam, gdzie żaden model nie ma prognozy
        return (np.nan_to_num(fcc) * w).sum(0) / w.sum(0)
