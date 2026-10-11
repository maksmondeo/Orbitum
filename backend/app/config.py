"""Ustawienia backendu: modele, siatka, okna czasowe i ścieżki."""
import os
from pathlib import Path

import numpy as np

DATABASE_URL = os.environ["DATABASE_URL"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
DATA = Path(os.environ.get("DATA_DIR", "/data/backtest"))   # cache runów, ERA5 i mapy modeli (wspólne z notebookiem)
S3 = "https://openmeteo.s3.amazonaws.com"

_MODELS = {"ecmwf_ifs025": "ECMWF IFS", "ecmwf_aifs025_single": "ECMWF AIFS", "ncep_gfs013": "NCEP GFS",
           "ncep_aigfs025": "NCEP AIGFS", "dwd_icon": "DWD ICON", "meteofrance_arpege_world025": "MF ARPEGE",
           "ukmo_global_deterministic_10km": "UKMO"}
MODELS = {                                                   # zmienna -> {id modelu w buckecie: etykieta}
    "temperature_2m": _MODELS,
    "pressure_msl": {("ncep_gfs025" if m == "ncep_gfs013" else m): l for m, l in _MODELS.items()},  # gfs013 nie ma ciśnienia
}
ERA5_SCALE = {"temperature_2m": 1, "pressure_msl": 0.01}     # ERA5 trzyma ciśnienie w Pa, modele w hPa

LAT = np.arange(49, 55.01, 0.25)                             # siatka ERA5 0.25° nad Polską
LON = np.arange(14, 24.26, 0.25)
MAX_LEAD = 168                                               # prognoza na 7 dni od odświeżenia
RUN_LEADS = np.arange(193)                                   # lead od runu w cache: 168 h + zapas na wiek runu
BUCKET_H = 6                                                 # bucket leadu w mapie modeli
WINDOW_DAYS = 60                                             # okno backtestu przy przeliczeniu
HALF_LIFE_D = 21                                             # półokres wagi slotu
MIN_COVERAGE = 0.9                                           # min. pokrycie bucketu, żeby model brał udział w wyborze
BIAS_DAYS = 28                                               # okno biasu [dni ERA5]
BIAS_REFRESH_D = 7                                           # co ile dni przeliczamy bias
