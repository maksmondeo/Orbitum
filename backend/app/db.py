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


def alert_hits():
    """Godziny prognozy spełniające warunek aktywnego alertu, jeszcze niewysłane; dla obszaru wartość skrajna."""
    return execute("""
        SELECT a.id, a.variable, a.op, a.threshold, a.lat_min, a.lat_max, a.lon_min, a.lon_max, c.kind, c.target,
               f.valid_time, CASE a.op WHEN '<' THEN min(f.value) ELSE max(f.value) END AS value
        FROM alerts a
        JOIN channels c ON c.id = a.channel_id
        JOIN forecast f ON f.variable = a.variable
         AND f.lat BETWEEN a.lat_min AND a.lat_max AND f.lon BETWEEN a.lon_min AND a.lon_max
         AND f.valid_time BETWEEN coalesce(a.valid_from, '-infinity') AND coalesce(a.valid_to, 'infinity')
        WHERE a.active
          AND CASE a.op WHEN '<' THEN f.value < a.threshold ELSE f.value > a.threshold END
          AND NOT EXISTS (SELECT 1 FROM alert_events e WHERE e.alert_id = a.id AND e.valid_time = f.valid_time)
        GROUP BY a.id, c.id, f.valid_time
        ORDER BY a.id, f.valid_time""")


def add_alert_events(alert_id, events):
    """Zapis wysłanych godzin alertu: events = [(valid_time, value), ...]."""
    with psycopg.connect(DATABASE_URL) as conn:
        conn.cursor().executemany("INSERT INTO alert_events (alert_id, valid_time, value) VALUES (%s, %s, %s)",
                                  [(alert_id, t, v) for t, v in events])


def forecast_point(variable, lat, lon):
    return execute("SELECT valid_time, value FROM forecast WHERE variable = %s AND lat = %s AND lon = %s "
                   "ORDER BY valid_time", variable, lat, lon)


def forecast_map(variable, valid_time):
    return execute("SELECT lat, lon, value FROM forecast WHERE variable = %s AND valid_time = %s",
                   variable, valid_time)
