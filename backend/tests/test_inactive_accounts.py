from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import User


def test_inactive_account_cannot_login_refresh_or_access(client):
    credentials = {"email": "inactive@example.com", "password": "password123"}
    registered = client.post("/api/v1/auth/register", json=credentials).json()
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 200
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": registered["refresh_token"]})
    assert refreshed.status_code == 200
    tokens = refreshed.json()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == credentials["email"]))
        user.is_active = False
        db.commit()
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 401
