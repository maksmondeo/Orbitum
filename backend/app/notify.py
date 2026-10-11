"""Wysyłka powiadomień na kanały użytkowników (na razie Telegram)."""
import requests

from app.config import TELEGRAM_BOT_TOKEN


def telegram(chat_id, text):
    r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                      json={"chat_id": chat_id, "text": text}, timeout=30)
    if not r.ok:                                          # bez raise_for_status: jego komunikat zawiera URL z tokenem
        raise RuntimeError(f"Telegram {r.status_code}: {r.text}")


SENDERS = {"telegram": telegram}


def send(kind, target, text):
    SENDERS[kind](target, text)
