"""Kanały i alerty zalogowanego użytkownika: wspólny CRUD dla obu tabel oraz historia wysłanych alertów."""
from fastapi import APIRouter, Depends, HTTPException

from app import db, notify
from app.api.schemas import Alert, Channel
from app.auth import current_user

TEST_MESSAGE = "✅ Orbitum: wiadomość testowa. Ten kanał działa, alerty będą przychodzić tutaj."


def one(rows):
    if not rows:
        raise HTTPException(404, "nie znaleziono")
    return rows[0]


def owned(table, Body):
    """Router CRUD dla tabeli z kolumną user_id: każdy widzi i zmienia tylko swoje wiersze."""
    router = APIRouter(prefix=f"/{table}", tags=[table])
    cols = list(Body.model_fields)

    @router.get("")
    def list_rows(user=Depends(current_user)):
        return db.execute(f"SELECT * FROM {table} WHERE user_id = %s ORDER BY id", user["id"])

    @router.post("", status_code=201)
    def create(body: Body, user=Depends(current_user)):
        return one(db.execute(f"INSERT INTO {table} (user_id, {', '.join(cols)}) VALUES (%s{', %s' * len(cols)}) "
                              "RETURNING *", user["id"], *body.model_dump().values()))

    @router.put("/{row_id}")
    def update(row_id: int, body: Body, user=Depends(current_user)):
        return one(db.execute(f"UPDATE {table} SET {', '.join(f'{c} = %s' for c in cols)} "
                              "WHERE id = %s AND user_id = %s RETURNING *", *body.model_dump().values(), row_id, user["id"]))

    @router.delete("/{row_id}", status_code=204)
    def delete(row_id: int, user=Depends(current_user)):
        one(db.execute(f"DELETE FROM {table} WHERE id = %s AND user_id = %s RETURNING id", row_id, user["id"]))

    return router


channels = owned("channels", Channel)
alerts = owned("alerts", Alert)


@channels.post("/{row_id}/test")
def send_test(row_id: int, user=Depends(current_user)):
    """Wiadomość testowa na kanał użytkownika (K1). Błąd wysyłki oddaje jako {code, message}, żeby frontend
    pokazał radę po kodzie, a nie surowy angielski opis. Dla TELEGRAM_ERROR (zły token, limit, brak sieci)
    message jest stałym tekstem, bo to nie wina użytkownika (502)."""
    channel = one(db.execute("SELECT kind, target FROM channels WHERE id = %s AND user_id = %s", row_id, user["id"]))
    try:
        notify.send(channel["kind"], channel["target"], TEST_MESSAGE)
    except notify.SendError as e:
        if e.code == "TELEGRAM_ERROR":
            raise HTTPException(502, {"code": e.code, "message": "Nie udało się wysłać wiadomości przez Telegram."})
        raise HTTPException(400, {"code": e.code, "message": e.description})
    return {"ok": True}


@alerts.get("/events")
def events(user=Depends(current_user)):
    """Historia wysłanych alertów użytkownika (FR8), od najnowszych."""
    return db.execute("SELECT e.* FROM alert_events e JOIN alerts a ON a.id = e.alert_id WHERE a.user_id = %s "
                      "ORDER BY e.sent_at DESC, e.valid_time LIMIT 500", user["id"])
