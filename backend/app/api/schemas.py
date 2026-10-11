"""Dane wejściowe API (walidacja pydantic)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class Credentials(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)


class Channel(BaseModel):
    kind: Literal["telegram"]                     # Discord i e-mail dojdą razem z wysyłką w notify.py
    target: str = Field(min_length=1)             # chat_id Telegrama


class Alert(BaseModel):
    channel_id: int
    variable: Literal["temperature_2m", "pressure_msl"]
    lat_min: float = Field(ge=49, le=55)
    lat_max: float = Field(ge=49, le=55)
    lon_min: float = Field(ge=14, le=24.25)
    lon_max: float = Field(ge=14, le=24.25)
    op: Literal["<", ">"]
    threshold: float
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    active: bool = True

    @model_validator(mode="after")
    def check_area(self):
        """Punkt (min = max) przyciągamy do najbliższego węzła siatki 0.25°, bo prognoza jest tylko w węzłach."""
        if self.lat_min > self.lat_max or self.lon_min > self.lon_max:
            raise ValueError("min nie może być większe od max")
        if (self.lat_min, self.lon_min) == (self.lat_max, self.lon_max):
            self.lat_min = self.lat_max = round(self.lat_min * 4) / 4
            self.lon_min = self.lon_max = round(self.lon_min * 4) / 4
        return self
