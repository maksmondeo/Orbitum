"""Odczyt plików .om z bucketu S3 Open-Meteo po HTTP Range: pobieramy tylko wycinek Polski."""
import re

import numpy as np
import pandas as pd
import requests
from omfiles import OmFileReader

from app.config import LAT, LON, S3


class RangeFS:
    """Minimalny 'filesystem' dla omfiles (size + cat_file) na HTTP Range; jedna instancja = jeden plik.
    Bloki 64 KB z pamięcią podręczną: jeden blok obsługuje wiele sąsiednich chunków."""
    BLOCK = 64 * 1024

    def __init__(self):
        self.session, self.blocks = requests.Session(), {}

    def size(self, path):
        r = self.session.head(f"{S3}/{path}", timeout=30)
        r.raise_for_status()
        return int(r.headers["Content-Length"])

    def block(self, path, i):
        if i not in self.blocks:
            r = self.session.get(f"{S3}/{path}", timeout=60,
                                 headers={"Range": f"bytes={i * self.BLOCK}-{(i + 1) * self.BLOCK - 1}"})
            r.raise_for_status()
            self.blocks[i] = r.content
        return self.blocks[i]

    def cat_file(self, path, start, end, **_):
        b0 = start // self.BLOCK
        buf = b"".join(self.block(path, i) for i in range(b0, (end - 1) // self.BLOCK + 1))
        return buf[start - b0 * self.BLOCK:end - b0 * self.BLOCK]


def read_poland(path, wkt=None):
    """Plik .om -> (reader, wycinek [lat, lon, time]) w punktach siatki LAT × LON (najbliższy sąsiad).
    Pliki archiwum ERA5 nie mają crs_wkt, więc podajemy je z meta.json."""
    rd = OmFileReader.from_fsspec(RangeFS(), path)
    ny, nx, _ = rd.shape
    wkt = wkt or rd.get_child_by_name("crs_wkt").read_scalar()
    la0, lo0, la1, lo1 = map(float, re.search(r"BBOX\[([^\]]+)\]", wkt).group(1).split(","))
    i = np.abs(np.linspace(la0, la1, ny)[:, None] - LAT).argmin(0)
    j = np.abs(np.linspace(lo0, lo1, nx)[:, None] - LON).argmin(0)
    j0, j1 = int(j[0]), int(j[-1]) + 1
    return rd, np.stack([rd.read_array((int(k), slice(j0, j1), slice(None)))[j - j0] for k in i])


def meta(dataset):
    return requests.get(f"{S3}/data/{dataset}/static/meta.json", timeout=30).json()


def latest_run(model):
    """Inicjalizacja najnowszego runu modelu opublikowanego w buckecie."""
    return pd.Timestamp(meta(model)["last_run_initialisation_time"], unit="s")
