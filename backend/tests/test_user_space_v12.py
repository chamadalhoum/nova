from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import ServiceRequest, User


def register(client, email: str, **extra):
    payload = {"email": email, "password": "secretpass123", "full_name": "NOVA User", **extra}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_registration_creates_only_standard_users_and_me_includes_account_created_at(client):
    forbidden_role = client.post(
        "/api/v1/auth/register",
        json={"email": "forbidden@example.com", "password": "secretpass123", "full_name": "Forbidden", "role": "admin"},
    )
    assert forbidden_role.status_code == 422
    headers = register(client, "standard@example.com")

    me = client.get("/api/v1/me", headers=headers)

    assert me.status_code == 200
    assert me.json()["role"] == "user"
    assert me.json()["created_at"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "standard@example.com"))
        assert user is not None
        assert user.role == "user"
        assert user.password_hash != "secretpass123"


def test_registration_rejects_blank_full_name_and_duplicate_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "invalid@example.com", "password": "secretpass123", "full_name": "   "},
    )
    assert response.status_code == 422

    register(client, "duplicate@example.com")
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": "duplicate@example.com", "password": "secretpass123", "full_name": "Duplicate"},
    )
    assert duplicate.status_code == 409


def test_service_request_list_is_owned_by_authenticated_user(client):
    owner_headers = register(client, "owner@example.com")
    other_headers = register(client, "other@example.com")
    owner_id = client.get("/api/v1/me", headers=owner_headers).json()["id"]
    other_id = client.get("/api/v1/me", headers=other_headers).json()["id"]
    with SessionLocal() as db:
        db.add_all(
            [
                ServiceRequest(user_id=owner_id, status="PREPARED", risk_level="LOW", data={"category": "plumbing"}),
                ServiceRequest(user_id=other_id, status="CONFIRMED", risk_level="LOW", data={"category": "electricity"}),
            ]
        )
        db.commit()

    response = client.get("/api/v1/service-requests", headers=owner_headers)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["data"]["category"] == "plumbing"
