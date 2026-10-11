"""Alerty po odświeżeniu: nowe godziny prognozy, które spełniają warunek alertu -> jedna wiadomość na alert."""
import traceback
from itertools import groupby

from app import db, notify

NAMES = {"temperature_2m": ("temperatura 2 m", "°C"), "pressure_msl": ("ciśnienie", "hPa")}


def message(rows):
    """Treść powiadomienia dla jednego alertu: warunek, miejsce, przedział godzin i wartość skrajna."""
    a = rows[0]
    name, unit = NAMES[a["variable"]]
    extreme = min(r["value"] for r in rows) if a["op"] == "<" else max(r["value"] for r in rows)
    place = f"{a['lat_min']:.2f}°N {a['lon_min']:.2f}°E" + (
        f" – {a['lat_max']:.2f}°N {a['lon_max']:.2f}°E" if (a["lat_min"], a["lon_min"]) != (a["lat_max"], a["lon_max"]) else "")
    return (f"⚠️ Orbitum: {name} {a['op']} {a['threshold']:g} {unit}\n"
            f"miejsce: {place}\n"
            f"{rows[0]['valid_time']:%d.%m %H:%M} – {rows[-1]['valid_time']:%d.%m %H:%M} UTC ({len(rows)} h), "
            f"{'minimum' if a['op'] == '<' else 'maksimum'} {extreme:.1f} {unit}")


def check_alerts():
    """Wysyła powiadomienia o nowych godzinach spełniających warunek i zapisuje je w alert_events.
    Błąd wysyłki jednego alertu nie blokuje pozostałych, a niewysłane godziny wrócą przy kolejnym odświeżeniu."""
    for alert_id, rows in groupby(db.alert_hits(), key=lambda r: r["id"]):
        rows = list(rows)
        try:
            notify.send(rows[0]["kind"], rows[0]["target"], message(rows))
            db.add_alert_events(alert_id, [(r["valid_time"], r["value"]) for r in rows])
        except Exception:
            traceback.print_exc()
