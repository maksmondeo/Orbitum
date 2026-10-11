"""Backtest: symulacja produkcji, RMSE z wagami czasowymi i bias z korektą walk-forward (jak w notebooku)."""
import numpy as np
import pandas as pd
import xarray as xr

from app.config import BIAS_DAYS, BIAS_REFRESH_D, BUCKET_H, HALF_LIFE_D, LAT, LON, MAX_LEAD, MIN_COVERAGE, RUN_LEADS
from app.weather.cache import load_run

LEADS = np.arange(1, MAX_LEAD + 1)


def epoch_s(t):
    return np.asarray((t - pd.Timestamp(0)) // pd.Timedelta(seconds=1))


def simulate(variable, model, runs, slots):
    """Prognoza [slot, lead 1…168, lat, lon]: w każdym slocie najnowszy run opublikowany przed slotem."""
    cube = np.full((len(runs), len(RUN_LEADS), len(LAT), len(LON)), np.nan, np.float32)
    created = np.full(len(runs), np.inf)                           # brak runu = nigdy nie opublikowany
    for k, run in enumerate(runs):
        if (r := load_run(variable, model, run)) is not None:
            cube[k], created[k] = r
    run_s, slot_s = epoch_s(runs), epoch_s(slots)
    k = np.array([np.flatnonzero(created <= t).max(initial=-1) for t in slot_s])
    r = ((slot_s - run_s[k]) // 3600)[:, None] + LEADS               # lead od runu = wiek runu + lead od slotu
    ok = (k[:, None] >= 0) & (r < len(RUN_LEADS))
    return np.where(ok[..., None, None], cube[k[:, None], np.clip(r, 0, len(RUN_LEADS) - 1)], np.nan)


def forecasts(variable, models, runs, slots):
    """Symulacja dla wszystkich modeli -> FC [model, slot, lead, lat, lon]."""
    return xr.DataArray(np.stack([simulate(variable, m, runs, slots) for m in models]),
                        dims=("model", "slot", "lead", "lat", "lon"),
                        coords={"model": list(models), "slot": slots, "lead": LEADS, "lat": LAT, "lon": LON})


def observations(era, fc):
    """ERA5 w czasie ważności każdej prognozy [slot, lead, lat, lon]; NaN, gdzie ERA5 jeszcze nie ma."""
    valid = fc.slot + fc.lead * np.timedelta64(1, "h")
    era = era.reindex(time=pd.date_range(era.time.values[0], valid.values.max(), freq="h"))
    return era.sel(time=valid).drop_vars("time")


def decay(slots, end):
    """Waga slotu 0.5 ** (wiek / HALF_LIFE_D), wiek w dniach liczony od `end`."""
    return np.asarray(0.5 ** ((end - slots) / pd.Timedelta(days=HALF_LIFE_D)))


def weighted_rmse(fc, obs, w, min_coverage=MIN_COVERAGE):
    """Ważony RMSE [model, bucket, lat, lon]; NaN, gdy model ma za małe pokrycie bucketu.
    Liczymy model po modelu, żeby nie trzymać w pamięci błędów wszystkich modeli naraz."""
    w = xr.DataArray(np.asarray(w, np.float32), dims="slot")
    per_bucket = lambda x: x.coarsen(lead=BUCKET_H, coord_func="min").sum().sum("slot")
    num = xr.concat([per_bucket((f - obs) ** 2 * w) for f in fc], "model")
    den = xr.concat([per_bucket((f - obs).notnull() * w) for f in fc], "model")
    return np.sqrt(num / den).where(den >= min_coverage * den.max("model")).rename(lead="bucket")


def error_sums(fc, obs):
    """Suma i liczba błędów po czasie ważności -> (t0, suma, liczba), tablice [model, godzina od t0, lat, lon].
    Każda godzina zbiera błędy wszystkich slotów i leadów, które się wtedy weryfikują."""
    t0 = pd.Timestamp(fc.slot.values[0])
    ix = ((fc.slot.to_index() - t0) // pd.Timedelta(hours=1)).to_numpy()[:, None] + LEADS
    s = np.zeros((fc.sizes["model"], ix.max() + 1, len(LAT), len(LON)), np.float32)
    n = np.zeros_like(s)
    for l in range(MAX_LEAD):                                       # dla ustalonego leadu indeksy się nie powtarzają
        e = (fc[:, :, l] - obs[:, l]).values
        s[:, ix[:, l]] += np.nan_to_num(e)
        n[:, ix[:, l]] += np.isfinite(e)
    return t0, s, n


def bias_at(sums, era5_end):
    """Bias [model, godzina doby, lat, lon]: średni błąd z ostatnich BIAS_DAYS dni ERA5 przed `era5_end`."""
    t0, s, n = sums
    end = (era5_end.floor("D") - t0) // pd.Timedelta(hours=1)       # północ UTC, więc reshape daje godziny doby
    s, n = (a[:, end - 24 * BIAS_DAYS:end].reshape(len(a), BIAS_DAYS, 24, len(LAT), len(LON)).sum(1) for a in (s, n))
    return np.where(n > 0, s / np.maximum(n, 1), 0)


def walk_forward(fc, sums, decisions, lag, max_lead=MAX_LEAD):
    """Prognozy po korekcie: bias znany w chwili decyzji D (ERA5 do D − lag) odejmujemy od slotów do następnej
    decyzji, na leadach <= max_lead (liczba albo wartość per model). Sloty przed pierwszą decyzją: NaN."""
    slots = fc.slot.to_index()
    fcc = np.full(fc.shape, np.nan, np.float32)
    on = LEADS[None, None, :, None, None] <= np.broadcast_to(max_lead, fc.sizes["model"])[:, None, None, None, None]
    for d in decisions:
        sel = np.flatnonzero((slots >= d) & (slots < d + pd.Timedelta(days=BIAS_REFRESH_D)))
        hod = (slots.hour.values[sel, None] + LEADS) % 24              # godzina doby czasu ważności [slot, lead]
        fcc[:, sel] = fc.values[:, sel] - bias_at(sums, d - lag)[:, hod] * on
    return fc.copy(data=fcc)


def gain_by_day(fcc, fc, obs):
    """Zysk z korekty [model, dzień prognozy] w % RMSE, na prognozach, które mają korektę."""
    rmse = lambda x: np.sqrt(((x - obs) ** 2).where(fcc.notnull()).coarsen(lead=24).mean().mean(["slot", "lat", "lon"]))
    return 100 * (1 - rmse(fcc) / rmse(fc))
