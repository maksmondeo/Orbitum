"""Postgres: przebiegi zadań (jobs) i najnowsza prognoza (forecast)."""
import numpy as np
import pandas as pd
import psycopg
from psycopg.rows import dict_row

from app.config import DATABASE_URL, LAT, LON


def execute(sql, *args):
    """Wykonuje zapytanie w osobnej transakcji -> wiersze jako słowniki (albo None, gdy zapytanie ich nie zwraca)."""
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        cur = conn.execute(sql, args)
        return cur.fetchall() if cur.description else None


def job_start(kind):
    return execute("INSERT INTO jobs (kind) VALUES (%s) RETURNING id", kind)[0]["id"]


def job_finish(job_id, status, message=None):
    execute("UPDATE jobs SET finished_at = now(), status = %s, message = %s WHERE id = %s", status, message, job_id)


def jobs():
    return execute("SELECT * FROM jobs ORDER BY id DESC LIMIT 20")


def write_forecast(variable, slot, values):
    """Podmienia prognozę zmiennej na nową: values [lead 1…168, lat, lon] od `slot`."""
    times = (slot + pd.to_timedelta(np.arange(1, len(values) + 1), "h")).tz_localize("UTC").to_pydatetime()
    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:   # jedna transakcja: DELETE + COPY
        cur.execute("DELETE FROM forecast WHERE variable = %s", (variable,))
        with cur.copy("COPY forecast (variable, lat, lon, valid_time, value) FROM STDIN") as copy:
            for (t, i, j), v in np.ndenumerate(values):
                if np.isfinite(v):
                    copy.write_row((variable, float(LAT[i]), float(LON[j]), times[t], float(v)))


def forecast_point(variable, lat, lon):
    return execute("SELECT valid_time, value FROM forecast WHERE variable = %s AND lat = %s AND lon = %s "
                   "ORDER BY valid_time", variable, lat, lon)


def forecast_map(variable, valid_time):
    return execute("SELECT lat, lon, value FROM forecast WHERE variable = %s AND valid_time = %s",
                   variable, valid_time)
