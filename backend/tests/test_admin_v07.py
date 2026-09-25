from uuid import uuid4

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.models import User


def make_admin_headers(client, email: str = "admin@example.com") -> dict[str, str]:
    del client
    db = SessionLocal()
    try:
        user = User(
            email=f"{uuid4().hex}-{email}",
            password_hash=hash_password("secretpass123"),
            full_name="NOVA Admin",
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id)
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def test_v07_normal_user_cannot_access_admin(client, auth_headers):
    response = client.get("/api/v1/admin/dashboard", headers=auth_headers)
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "HTTP_ERROR"
    assert body["error"]["message"] == "Admin access required"


def test_v07_admin_can_access_dashboard_and_request_id(client):
    headers = {**make_admin_headers(client), "X-Request-ID": "req-v07-admin-1"}
    response = client.get("/api/v1/admin/dashboard", headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["X-Request-ID"] == "req-v07-admin-1"
    body = response.json()
    assert body["total_users"] >= 1
    assert "real_provider_bookings" in body["unavailable_metrics"]


def test_v07_admin_lists_are_paginated(client):
    headers = make_admin_headers(client)
    ok = client.get("/api/v1/admin/users?limit=1&offset=0", headers=headers)
    assert ok.status_code == 200, ok.text
    assert ok.json()["limit"] == 1
    assert len(ok.json()["items"]) == 1

    rejected = client.get("/api/v1/admin/users?limit=101", headers=headers)
    assert rejected.status_code == 422


def test_v07_admin_role_does_not_bypass_user_resource_ownership(client, auth_headers):
    owner = client.get("/api/v1/me", headers=auth_headers).json()
    task = client.post("/api/v1/tasks", json={"title": "Private task"}, headers=auth_headers)
    assert task.status_code == 201, task.text
    admin_headers = make_admin_headers(client)

    protected = client.get(f"/api/v1/tasks/{task.json()['id']}", headers=admin_headers)
    assert protected.status_code == 404

    admin_list = client.get(f"/api/v1/admin/tasks?user_id={owner['id']}", headers=admin_headers)
    assert admin_list.status_code == 200
    assert admin_list.json()["items"][0]["id"] == task.json()["id"]


def test_v07_admin_ai_observability_is_sanitized(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    assert conversation.status_code == 201
    raw_prompt = "My private prompt with proposed_task and entities should not be exposed"
    message = client.post(
        f"/api/v1/conversations/{conversation.json()['id']}/messages",
        json={"content": raw_prompt},
        headers=auth_headers,
    )
    assert message.status_code == 200, message.text

    admin_headers = make_admin_headers(client)
    ai_events = client.get("/api/v1/admin/ai-events", headers=admin_headers)
    assert ai_events.status_code == 200, ai_events.text
    payload = str(ai_events.json())
    assert raw_prompt not in payload
    assert "proposed_task" not in payload
    assert "entities" not in payload
    assert "provider" in payload
    assert "confidence" in payload


def test_v07_admin_audit_logs_do_not_expose_raw_prompt(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers).json()
    raw_prompt = "raw prompt should stay out of admin audit logs"
    response = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        json={"content": raw_prompt},
        headers=auth_headers,
    )
    assert response.status_code == 200

    admin_headers = make_admin_headers(client)
    logs = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert logs.status_code == 200, logs.text
    payload = str(logs.json())
    assert raw_prompt not in payload
    assert "api_key" not in payload.lower()
