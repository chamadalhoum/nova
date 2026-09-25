import json
from datetime import UTC, datetime, timedelta

from jose import jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import check_rate_limit
from app.models import AuditLog


def register_user(client, email="v05@example.com"):
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "secretpass123"})
    assert response.status_code == 201, response.text
    return response.json()


def test_v05_complete_ac_service_journey_start_and_complete(client):
    tokens = register_user(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    login = client.post("/api/v1/auth/login", json={"email": "v05@example.com", "password": "secretpass123"})
    assert login.status_code == 200

    conversation = client.post("/api/v1/conversations", json={}, headers=headers)
    assert conversation.status_code == 201, conversation.text
    conversation_id = conversation.json()["id"]

    first = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "N7eb wa7ed ysala7li l clim ghodwa"},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["state"] == "needs_info"
    assert first.json()["intent"]["intent"] == "service_request"
    assert first.json()["intent"]["category"] == "air_conditioning"
    assert "location" in first.json()["intent"]["missing_fields"]

    second = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "Ariana"},
        headers=headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["state"] == "waiting_confirmation"
    assert second.json()["intent"]["intent"] == "service_request"
    assert second.json()["intent"]["category"] == "air_conditioning"
    assert second.json()["proposed_task"]["location"] == "Ariana"

    task = client.post(f"/api/v1/conversations/{conversation_id}/confirm-task", headers=headers)
    assert task.status_code == 200, task.text
    task_id = task.json()["id"]
    assert task.json()["status"] == "CONFIRMED"

    search = client.post(f"/api/v1/tasks/{task_id}/search-services", headers=headers)
    assert search.status_code == 200, search.text
    provider = search.json()["results"][0]
    assert provider["is_demo"] is True

    selected = client.post(
        f"/api/v1/tasks/{task_id}/select-provider",
        json={"provider_id": provider["id"]},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    request_id = selected.json()["data"]["service_request"]["id"]
    assert selected.json()["data"]["service_request"]["status"] == "PREPARED"

    confirmed = client.post(f"/api/v1/service-requests/{request_id}/confirm", headers=headers)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "CONFIRMED"
    assert confirmed.json()["data"]["external_action_executed"] is False

    started = client.post(f"/api/v1/tasks/{task_id}/start", headers=headers)
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "IN_PROGRESS"

    completed = client.post(f"/api/v1/tasks/{task_id}/complete", headers=headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "COMPLETED"
    assert [event["event_type"] for event in completed.json()["events"]] == [
        "created",
        "clarification_requested",
        "information_received",
        "plan_created",
        "confirmation_requested",
        "confirmed",
        "service_options_found",
        "provider_selected",
        "service_request_prepared",
        "service_request_confirmed",
        "started",
        "completed",
    ]


def test_v05_invalid_task_transition_fails_cleanly(client, auth_headers):
    task = client.post("/api/v1/tasks", json={"title": "Manual"}, headers=auth_headers).json()
    completed = client.post(f"/api/v1/tasks/{task['id']}/complete", headers=auth_headers)
    assert completed.status_code == 200
    response = client.post(f"/api/v1/tasks/{task['id']}/cancel", headers=auth_headers)
    assert response.status_code == 409
    assert "cannot move" in response.json()["detail"]


def test_v05_expired_jwt_is_rejected(client):
    tokens = register_user(client, "expired@example.com")
    payload = jwt.decode(tokens["access_token"], settings.jwt_secret, algorithms=["HS256"])
    expired = jwt.encode(
        {
            "sub": payload["sub"],
            "type": "access",
            "iat": int((datetime.now(UTC) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(UTC) - timedelta(hours=1)).timestamp()),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_v05_revoked_refresh_token_is_rejected(client):
    tokens = register_user(client, "refresh@example.com")
    first = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200
    second = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert second.status_code == 401
    assert second.json()["detail"] == "Invalid refresh token"


def test_v05_unauthorized_conversation_and_memory_access(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers).json()
    memory = client.post(
        "/api/v1/memories",
        json={"type": "preference", "key": "tone", "value": "calm"},
        headers=auth_headers,
    ).json()
    other = register_user(client, "unauthorized@example.com")
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get(f"/api/v1/conversations/{conversation['id']}", headers=other_headers).status_code == 404
    assert client.delete(f"/api/v1/memories/{memory['id']}", headers=other_headers).status_code == 404


def test_v05_rate_limit_falls_back_when_redis_unavailable(monkeypatch):
    def fail_client():
        from redis.exceptions import RedisError

        raise RedisError("unavailable")

    attempts: dict = {}
    monkeypatch.setattr("app.core.rate_limit.get_redis_client", fail_client)
    assert check_rate_limit("test-key", 2, 60, attempts) is True
    assert check_rate_limit("test-key", 2, 60, attempts) is True
    assert check_rate_limit("test-key", 2, 60, attempts) is False


def test_v05_refresh_token_wrong_type_is_rejected(client):
    tokens = register_user(client, "wrongtype@example.com")
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_v05_refresh_endpoint_is_rate_limited(client):
    for _ in range(8):
        response = client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid-token"})
        assert response.status_code == 401
    limited = client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid-token"})
    assert limited.status_code == 429
    assert "wait" in limited.json()["detail"].lower()


def test_v05_ai_confirmation_audit_log_is_sanitized(client):
    tokens = register_user(client, "audit@example.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    conversation = client.post("/api/v1/conversations", json={}, headers=headers).json()
    raw_prompt = "My private kitchen leak details in Ariana tomorrow should not be in audit logs"
    response = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        json={"content": raw_prompt},
        headers=headers,
    )
    assert response.status_code == 200
    db = SessionLocal()
    try:
        logs = db.scalars(select(AuditLog).where(AuditLog.action == "ai.confirmation_required")).all()
        assert logs
        serialized = json.dumps([log.data for log in logs])
        assert raw_prompt not in serialized
        assert "provider" in logs[0].data
        assert "intent" in logs[0].data
    finally:
        db.close()
