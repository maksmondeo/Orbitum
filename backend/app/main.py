"""Backend Orbitum: REST API i harmonogram zadań w jednym procesie."""
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, crud, forecast, jobs, users
from app.jobs.runner import start_scheduler


@asynccontextmanager
async def lifespan(_):
    start_scheduler()
    yield


app = FastAPI(title="Orbitum", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])  # frontend z innego kontenera
for router in (users.router, crud.channels, crud.alerts, forecast.router, jobs.router, admin.router):
    app.include_router(router)


@app.exception_handler(psycopg.errors.IntegrityError)
def integrity_error(_, e):
    """Naruszenie ograniczeń bazy (zajęty e-mail, cudzy kanał w alercie) -> 400 z opisem z Postgresa."""
    return JSONResponse({"detail": e.diag.message_primary}, status_code=400)
