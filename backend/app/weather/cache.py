"""Cache na dysku: runy jako npz (prognoza godzinowa [lead 0…192, lat, lon] + created_at) i ERA5 jako netCDF.
Format jak w notebooku, więc oba korzystają z tych samych plików."""
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import requests
import xarray as xr
from scipy.interpolate import PchipInterpolator

from app.config import DATA, ERA5_SCALE, LAT, LON, RUN_LEADS
from app.weather.s3 import meta, read_poland


def run_file(variable, model, run):
    return DATA / "runs" / variable / model / f"{run:%Y%m%d%H}.npz"


def download_run(variable, model, run):
    """Pobiera run do cache, interpolując go do kroku 1 h (PCHIP). Brak runu w buckecie albo błąd sieci: pomija."""
    try:
        rd, blk = read_poland(f"data_run/{model}/{run:%Y/%m/%d/%H%M}Z/{variable}.om")
    except (requests.RequestException, RuntimeError):     # omfiles opakowuje błędy sieci w RuntimeError
        return
    ref = rd.get_child_by_name("forecast_reference_time").read_scalar()
    lead = (rd.get_child_by_name("time").read_array((slice(None),)) - ref) / 3600
    hourly = PchipInterpolator(lead, blk, axis=2, extrapolate=False)(RUN_LEADS)   # poza zasięgiem runu: NaN
    run_file(variable, model, run).parent.mkdir(parents=True, exist_ok=True)
    np.savez(run_file(variable, model, run), fc=hourly.transpose(2, 0, 1).astype(np.float32),
             created=rd.get_child_by_name("created_at").read_scalar())


def download_runs(variable, models, runs):
    """Dociąga do cache brakujące runy wszystkich modeli."""
    todo = [(m, r) for m in models for r in runs if not run_file(variable, m, r).exists()]
    with ThreadPoolExecutor(12) as ex:
        list(ex.map(lambda mr: download_run(variable, *mr), todo))


def load_run(variable, model, run):
    """-> (prognoza [lead, lat, lon], created_at w s) albo None, gdy runu nie ma w cache."""
    f = run_file(variable, model, run)
    if f.exists():
        d = np.load(f)
        return d["fc"], int(d["created"])
    return None


def era5(variable, start, end):
    """ERA5 [time, lat, lon] od `start` do `end` (bez `end`) w jednostkach modeli; cache na dysku per okno."""
    path = DATA / f"era5_{variable}_{start:%Y%m%d%H}_{end:%Y%m%d%H}.nc"
    if not path.exists():
        m = meta("copernicus_era5")
        n = m["chunk_time_length"]                         # godzin w jednym pliku archiwum
        chunks = range(int(start.timestamp()) // 3600 // n, (int(end.timestamp()) // 3600 - 1) // n + 1)
        with ThreadPoolExecutor(8) as ex:
            blocks = list(ex.map(lambda c: read_poland(f"data/copernicus_era5/{variable}/chunk_{c}.om", m["crs_wkt"])[1],
                                 chunks))
        era = np.concatenate(blocks, axis=2).transpose(2, 0, 1)
        time = pd.to_datetime((chunks[0] * n + np.arange(len(era))) * 3600, unit="s")
        xr.DataArray(era, name=variable, coords={"time": time, "lat": LAT, "lon": LON}) \
          .sel(time=slice(start, end - pd.Timedelta(hours=1))).to_netcdf(path)
    return xr.open_dataarray(path).load() * ERA5_SCALE[variable]
