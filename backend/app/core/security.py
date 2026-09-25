from datetime import UTC, datetime, timedelta
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_token(subject: str, secret: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def create_access_token(user_id: str) -> str:
    return create_token(
        user_id,
        settings.jwt_secret,
        timedelta(minutes=settings.access_token_minutes),
        "access",
    )


def create_refresh_token(user_id: str) -> str:
    return create_token(
        user_id,
        settings.jwt_refresh_secret,
        timedelta(days=settings.refresh_token_days),
        "refresh",
    )


def decode_token(token: str, secret: str, expected_type: str) -> dict[str, str]:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != expected_type or not payload.get("sub"):
        raise ValueError("Invalid token")
    return payload
