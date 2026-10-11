"""Panel administratora: statystyki (FR11), użytkownicy (FR12) i alerty (FR13). Status zadań (FR14): /jobs."""
from fastapi import APIRouter, Depends

from app import db
from app.api.crud import one
from app.auth import admin_user

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


@router.get("/stats")
def stats():
    return db.execute("""
        SELECT (SELECT count(*) FROM users) AS users,
               (SELECT count(*) FROM alerts WHERE active) AS active_alerts,
               (SELECT count(*) FROM alert_events WHERE sent_at > now() - interval '24 hours') AS alerts_sent_24h,
               (SELECT max(valid_time) FROM forecast) AS forecast_until,
               (SELECT status FROM jobs WHERE kind = 'refresh' ORDER BY id DESC LIMIT 1) AS last_refresh,
               (SELECT status FROM jobs WHERE kind = 'recompute' ORDER BY id DESC LIMIT 1) AS last_recompute""")[0]


@router.get("/users")
def users():
    return db.execute("SELECT id, email, is_admin, created_at FROM users ORDER BY id")


@router.put("/users/{user_id}")
def set_admin(user_id: int, is_admin: bool):
    return one(db.execute("UPDATE users SET is_admin = %s WHERE id = %s RETURNING id, email, is_admin, created_at",
                          is_admin, user_id))


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int):
    one(db.execute("DELETE FROM users WHERE id = %s RETURNING id", user_id))


@router.get("/alerts")
def alerts():
    return db.execute("SELECT * FROM alerts ORDER BY id")


@router.delete("/alerts/{alert_id}", status_code=204)
def delete_alert(alert_id: int):
    one(db.execute("DELETE FROM alerts WHERE id = %s RETURNING id", alert_id))
