"""Wysyłka powiadomień na kanały użytkowników (na razie Telegram)."""
import requests

from app.config import TELEGRAM_BOT_TOKEN

# Fragment opisu błędu z Telegrama -> stabilny kod, który API i frontend rozpoznają zamiast angielskiego tekstu.
TELEGRAM_CODES = {
    "chat not found": "CHAT_NOT_FOUND",
    "can't initiate conversation": "BOT_NOT_STARTED",
    "bot was blocked by the user": "BOT_BLOCKED",
}


class SendError(RuntimeError):
    """Nieudana wysyłka. code to stabilny kod błędu (TELEGRAM_CODES albo TELEGRAM_ERROR dla reszty),
    description to opis z Telegrama. Nie zawiera URL-a z tokenem, więc komunikat można zapisać w logach."""

    def __init__(self, code, description):
        super().__init__(f"{code}: {description}")
        self.code = code
        self.description = description


def telegram(chat_id, text):
    try:
        r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                          json={"chat_id": chat_id, "text": text}, timeout=30)
    except requests.RequestException:                     # tekst wyjątku requests zawiera URL z tokenem, dlatego `from None`
        raise SendError("TELEGRAM_ERROR", "brak połączenia z Telegramem") from None
    if r.ok:
        return
    try:
        description = str(r.json()["description"])
    except (ValueError, KeyError, TypeError):             # odpowiedź nie jest JSON-em ze słownikiem z polem description
        description = ""
    code = next((c for part, c in TELEGRAM_CODES.items() if part in description), "TELEGRAM_ERROR")
    raise SendError(code, description or f"HTTP {r.status_code}")


SENDERS = {"telegram": telegram}


def send(kind, target, text):
    SENDERS[kind](target, text)
