from datetime import UTC, datetime, timedelta

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

_redis_client: Redis | None = None
MAX_FALLBACK_KEYS = 4096


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.redis_url, socket_connect_timeout=0.2, socket_timeout=0.2)
    return _redis_client


def reset_redis_client() -> None:
    global _redis_client
    _redis_client = None


def check_rate_limit(key: str, limit: int, window_seconds: int, fallback_attempts: dict[str, list[datetime]]) -> bool:
    redis_key = f"nova:rate:{key}"
    try:
        client = get_redis_client()
        pipeline = client.pipeline(transaction=True)
        pipeline.incr(redis_key)
        pipeline.expire(redis_key, window_seconds, nx=True)
        count, _ = pipeline.execute()
        return int(count) <= limit
    except RedisError:
        now = datetime.now(UTC)
        window_start = now - timedelta(seconds=window_seconds)
        for existing_key, existing_attempts in list(fallback_attempts.items()):
            current = [attempt for attempt in existing_attempts if attempt > window_start]
            if current:
                fallback_attempts[existing_key] = current
            else:
                fallback_attempts.pop(existing_key, None)
        if len(fallback_attempts) >= MAX_FALLBACK_KEYS and key not in fallback_attempts:
            return False
        attempts = [attempt for attempt in fallback_attempts.get(key, []) if attempt > window_start]
        if len(attempts) >= limit:
            fallback_attempts[key] = attempts
            return False
        attempts.append(now)
        fallback_attempts[key] = attempts
        return True
