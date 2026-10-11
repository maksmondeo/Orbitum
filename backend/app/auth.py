"""Hasła (bcrypt, NFR3), tokeny JWT (NFR4) i zależności FastAPI z zalogowanym użytkownikiem."""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import db
from app.config import JWT_SECRET, TOKEN_HOURS


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())


def token(user_id):
    exp = datetime.now(UTC) + timedelta(hours=TOKEN_HOURS)
    return {"token": jwt.encode({"sub": str(user_id), "exp": exp}, JWT_SECRET, "HS256")}


def current_user(cred: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    try:
        user_id = int(jwt.decode(cred.credentials, JWT_SECRET, ["HS256"])["sub"])
    except jwt.PyJWTError:
        raise HTTPException(401, "nieprawidłowy albo wygasły token")
    rows = db.execute("SELECT id, email, is_admin, created_at FROM users WHERE id = %s", user_id)
    if not rows:
        raise HTTPException(401, "konto nie istnieje")
    return rows[0]


def admin_user(user=Depends(current_user)):
    if not user["is_admin"]:
        raise HTTPException(403, "tylko dla administratora")
    return user
