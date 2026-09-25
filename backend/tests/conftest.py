import os
from collections.abc import Generator

os.environ["DATABASE_URL"] = "sqlite:///./test_nova.db"
os.environ["JWT_SECRET"] = "test-access-secret-long"
os.environ["JWT_REFRESH_SECRET"] = "test-refresh-secret-long"

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_db() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    from app.api.v1.router import ai_attempts, auth_attempts
    from app.core.database import SessionLocal
    from app.core.rate_limit import reset_redis_client
    from app.seed import seed_demo_data

    auth_attempts.clear()
    ai_attempts.clear()
    reset_redis_client()
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass123", "full_name": "NOVA User"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
