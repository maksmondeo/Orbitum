"""Zadania w tle: harmonogram (odświeżenie co 6 h, przeliczenie co 7 dni) i uruchamianie ręczne z API.
To samo zadanie nie biegnie dwa razy naraz, a każdy przebieg trafia do tabeli jobs."""
import threading
import traceback

from apscheduler.schedulers.background import BackgroundScheduler

from app import db
from app.jobs.recompute import recompute
from app.jobs.refresh import refresh

TASKS = {"refresh": refresh, "recompute": recompute}
LOCKS = {kind: threading.Lock() for kind in TASKS}


def run(kind):
    """Startuje zadanie w osobnym wątku -> id przebiegu albo None, gdy to zadanie już trwa."""
    if not LOCKS[kind].acquire(blocking=False):
        return None
    try:
        job_id = db.job_start(kind)
    except Exception:
        LOCKS[kind].release()
        raise

    def work():
        try:
            TASKS[kind]()
            db.job_finish(job_id, "ok")
        except Exception as e:
            traceback.print_exc()
            db.job_finish(job_id, "error", f"{type(e).__name__}: {e}")
        finally:
            LOCKS[kind].release()

    threading.Thread(target=work, daemon=True).start()
    return job_id


def start_scheduler():
    db.execute("UPDATE jobs SET status = 'error', finished_at = now(), message = 'przerwane restartem' "
               "WHERE status = 'running'")
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run, "cron", hour="0,6,12,18", minute=5, args=["refresh"])
    scheduler.add_job(run, "cron", day_of_week="mon", hour=3, args=["recompute"])
    scheduler.start()
