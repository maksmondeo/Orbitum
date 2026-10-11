"""Ręczne uruchamianie i podgląd zadań."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.auth import admin_user
from app.jobs import runner

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(admin_user)])


@router.post("/{kind}", status_code=202)
def start(kind: Literal["refresh", "recompute"]):
    """Uruchamia zadanie w tle; 409, jeśli to samo zadanie już trwa."""
    if (job_id := runner.run(kind)) is None:
        raise HTTPException(409, f"{kind} już trwa")
    return {"id": job_id}


@router.get("")
def jobs():
    """Ostatnie przebiegi zadań."""
    return db.jobs()
