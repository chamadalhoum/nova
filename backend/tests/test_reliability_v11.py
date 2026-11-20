import base64

from sqlalchemy import event as sqlalchemy_event
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Attachment, Task


def create_task(client, headers, **overrides):
    payload = {"title": "Repair AC", "data": {"entities": {"location": "Ariana"}, "next_action": "search_services"}}
    payload.update(overrides)
    response = client.post("/api/v1/tasks", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def create_user_message(client, headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=headers)
    message = client.post(
        f"/api/v1/conversations/{conversation.json()['id']}/messages",
        json={"content": "Help me organize a small task"},
        headers=headers,
    )
    assert message.status_code == 200, message.text
    return message.json()["user_message"]["id"]


def test_task_update_rejects_workflow_metadata_and_preserves_existing_data(client, auth_headers):
    task = create_task(client, auth_headers)

    forbidden = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"data": {"next_action": "confirm_service_request"}},
        headers=auth_headers,
    )
    partial = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"data": {"user_notes": "Call after lunch"}},
        headers=auth_headers,
    )

    assert forbidden.status_code == 422
    assert partial.status_code == 200, partial.text
    assert partial.json()["data"]["entities"] == {"location": "Ariana"}
    assert partial.json()["data"]["next_action"] == "search_services"
    assert partial.json()["data"]["user_notes"] == "Call after lunch"


def test_task_update_rejects_null_for_non_nullable_fields_and_allows_null_due_date(client, auth_headers):
    task = create_task(client, auth_headers, due_date="tomorrow")

    invalid = client.patch(f"/api/v1/tasks/{task['id']}", json={"title": None}, headers=auth_headers)
    valid = client.patch(f"/api/v1/tasks/{task['id']}", json={"due_date": None}, headers=auth_headers)

    assert invalid.status_code == 422
    assert valid.status_code == 200, valid.text
    assert valid.json()["due_date"] is None


def test_task_update_enforces_ownership(client, auth_headers):
    task = create_task(client, auth_headers)
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "reliability-other@example.com", "password": "secretpass123"},
    )
    headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Not mine"}, headers=headers)

    assert response.status_code == 404


def test_confirm_task_is_idempotent_after_a_completed_response(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers).json()
    first_message = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        json={"content": "N7eb plombier ghodwa"},
        headers=auth_headers,
    )
    assert first_message.status_code == 200
    second_message = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        json={"content": "Ariana"},
        headers=auth_headers,
    )
    assert second_message.status_code == 200

    first = client.post(f"/api/v1/conversations/{conversation['id']}/confirm-task", headers=auth_headers)
    retry = client.post(f"/api/v1/conversations/{conversation['id']}/confirm-task", headers=auth_headers)

    assert first.status_code == 200, first.text
    assert retry.status_code == 200, retry.text
    assert retry.json()["id"] == first.json()["id"]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Task).where(Task.conversation_id == conversation["id"])) == 1


def test_upload_removes_file_when_database_commit_fails(client, auth_headers, monkeypatch, tmp_path):
    message_id = create_user_message(client, auth_headers)
    monkeypatch.setattr(settings, "attachment_storage_dir", str(tmp_path))
    original_commit = Session.commit

    def fail_attachment_commit(session):
        if any(isinstance(item, Attachment) for item in session.new):
            raise SQLAlchemyError("database unavailable")
        return original_commit(session)

    monkeypatch.setattr(Session, "commit", fail_attachment_commit)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json={"file_name": "note.txt", "content_type": "text/plain", "content_base64": base64.b64encode(b"hello").decode()},
        headers=auth_headers,
    )

    assert response.status_code == 500
    assert list(tmp_path.iterdir()) == []
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Attachment)) == 0


def test_upload_returns_safe_error_when_storage_write_fails(client, auth_headers, monkeypatch, tmp_path):
    message_id = create_user_message(client, auth_headers)
    monkeypatch.setattr(settings, "attachment_storage_dir", str(tmp_path))

    def fail_write(_path, _content):
        raise OSError("disk unavailable")

    monkeypatch.setattr("app.api.v1.router.Path.write_bytes", fail_write)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json={"file_name": "note.txt", "content_type": "text/plain", "content_base64": base64.b64encode(b"hello").decode()},
        headers=auth_headers,
    )

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "ATTACHMENT_STORAGE_FAILED"
    assert list(tmp_path.iterdir()) == []


def test_task_list_prefetches_timelines_instead_of_querying_per_task(client, auth_headers):
    for index in range(3):
        create_task(client, auth_headers, title=f"Task {index}")
    statements = []

    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if "task_events" in statement.lower():
            statements.append(statement)

    from app.core.database import engine

    sqlalchemy_event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.get("/api/v1/tasks", headers=auth_headers)
    finally:
        sqlalchemy_event.remove(engine, "before_cursor_execute", capture)

    assert response.status_code == 200, response.text
    assert len(statements) == 1
