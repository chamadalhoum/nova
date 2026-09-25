from datetime import datetime


def iso(value: datetime | None) -> str:
    return value.isoformat() if value else ""
