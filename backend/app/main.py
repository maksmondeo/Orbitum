"""Backend Orbitum: REST API i harmonogram zadań w jednym procesie."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import forecast, jobs
from app.jobs.runner import start_scheduler


@asynccontextmanager
async def lifespan(_):
    start_scheduler()
    yield


app = FastAPI(title="Orbitum", lifespan=lifespan)
app.include_router(jobs.router)
app.include_router(forecast.router)
