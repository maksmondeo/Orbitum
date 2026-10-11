"""Rejestracja, logowanie i konto zalogowanego użytkownika."""
from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.api.schemas import Credentials
from app.auth import check_password, current_user, hash_password, token
from app.config import ADMIN_EMAIL

router = APIRouter(tags=["users"])
USER = "id, email, is_admin, created_at"


@router.post("/auth/register", status_code=201)
def register(body: Credentials):
    """Zakłada konto i od razu zwraca token."""
    user = db.execute("INSERT INTO users (email, password_hash, is_admin) VALUES (%s, %s, %s) RETURNING id",
                      body.email, hash_password(body.password), body.email == ADMIN_EMAIL)[0]
    return token(user["id"])


@router.post("/auth/login")
def login(body: Credentials):
    rows = db.execute("SELECT id, password_hash FROM users WHERE email = %s", body.email)
    if not rows or not check_password(body.password, rows[0]["password_hash"]):
        raise HTTPException(401, "zły e-mail albo hasło")
    return token(rows[0]["id"])


@router.get("/me")
def me(user=Depends(current_user)):
    return user


@router.put("/me")
def update_me(body: Credentials, user=Depends(current_user)):
    """Zmiana e-maila i hasła."""
    return db.execute(f"UPDATE users SET email = %s, password_hash = %s WHERE id = %s RETURNING {USER}",
                      body.email, hash_password(body.password), user["id"])[0]


@router.delete("/me", status_code=204)
def delete_me(user=Depends(current_user)):
    """Usuwa konto razem z kanałami, alertami i ich historią."""
    db.execute("DELETE FROM users WHERE id = %s", user["id"])
