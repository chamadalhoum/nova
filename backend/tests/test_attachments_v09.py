from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.models import Attachment, Message, User


def attachment_payload(name: str = "note.txt", content: bytes = b"hello", content_type: str = "text/plain") -> dict[str, str]:
    import base64

    return {"file_name": name, "content_type": content_type, "content_base64": base64.b64encode(content).decode()}


def make_user_headers(email: str) -> dict[str, str]:
    db = SessionLocal()
    try:
        user = User(email=email, password_hash=hash_password("secretpass123"), full_name="Attachment User")
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id)
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def create_user_message(client, headers: dict[str, str]) -> str:
    conversation = client.post("/api/v1/conversations", json={}, headers=headers)
    assert conversation.status_code == 201, conversation.text
    message = client.post(
        f"/api/v1/conversations/{conversation.json()['id']}/messages",
        json={"content": "Help me organize a small task"},
        headers=headers,
    )
    assert message.status_code == 200, message.text
    return message.json()["user_message"]["id"]


def test_v09_attachment_upload_accepts_allowed_file(client, auth_headers):
    message_id = create_user_message(client, auth_headers)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json=attachment_payload(),
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["message_id"] == message_id
    assert body["file_name"] == "note.txt"
    assert body["content_type"] == "text/plain"
    assert body["size_bytes"] == 5
    assert "url" not in body


def test_v09_attachment_upload_rejects_invalid_mime(client, auth_headers):
    message_id = create_user_message(client, auth_headers)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json=attachment_payload("script.js", b"alert(1)", "application/javascript"),
        headers=auth_headers,
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "ATTACHMENT_TYPE_NOT_ALLOWED"


def test_v09_attachment_upload_enforces_message_ownership(client, auth_headers):
    message_id = create_user_message(client, auth_headers)
    other_headers = make_user_headers("other-attachment@example.com")
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json=attachment_payload(),
        headers=other_headers,
    )
    assert response.status_code == 404


def test_v09_attachment_upload_rejects_oversized_base64_before_decode(client, auth_headers):
    message_id = create_user_message(client, auth_headers)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json={"file_name": "large.txt", "content_type": "text/plain", "content_base64": "A" * 7_000_000},
        headers=auth_headers,
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "ATTACHMENT_TOO_LARGE"


def test_v09_attachment_upload_enforces_per_message_limit(client, auth_headers):
    message_id = create_user_message(client, auth_headers)
    for index in range(4):
        response = client.post(
            f"/api/v1/messages/{message_id}/attachments",
            json=attachment_payload(f"note-{index}.txt"),
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json=attachment_payload("note-4.txt"),
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ATTACHMENT_LIMIT_REACHED"


def test_v09_attachment_upload_enforces_user_storage_quota(client, auth_headers, monkeypatch):
    message_id = create_user_message(client, auth_headers)
    db = SessionLocal()
    try:
        message = db.get(Message, message_id)
        assert message is not None
        db.add(
            Attachment(
                message_id=message.id,
                file_name="existing.txt",
                content_type="text/plain",
                url="nova-attachment:existing",
                data={"size_bytes": 9},
            )
        )
        db.commit()
    finally:
        db.close()
    monkeypatch.setattr("app.api.v1.router.settings.attachment_user_storage_quota_bytes", 10)
    response = client.post(
        f"/api/v1/messages/{message_id}/attachments",
        json=attachment_payload("new.txt", b"ab"),
        headers=auth_headers,
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "ATTACHMENT_QUOTA_EXCEEDED"
