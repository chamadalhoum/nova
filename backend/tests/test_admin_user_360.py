from uuid import uuid4

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.models import AuditLog, ServiceRequest, Task, User


def create_user(*, email: str, full_name: str, role: str = "user") -> User:
    with SessionLocal() as db:
        user = User(
            email=email,
            password_hash=hash_password("secretpass123"),
            full_name=full_name,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        return user


def admin_headers() -> dict[str, str]:
    admin = create_user(
        email=f"admin-{uuid4().hex}@example.com",
        full_name="NOVA Admin",
        role="admin",
    )
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def test_admin_user_search_is_server_side_and_pagination_keeps_filter(client):
    headers = admin_headers()
    first = create_user(email="amelie@example.com", full_name="Amelie Durand")
    second = create_user(email="amelie.dupont@example.com", full_name="Amelie Dupont")
    create_user(email="other@example.com", full_name="Other Person")

    first_page = client.get("/api/v1/admin/users?q=%20Amelie%20&limit=1&offset=0", headers=headers)

    assert first_page.status_code == 200, first_page.text
    assert first_page.json()["total"] == 2
    assert first_page.json()["limit"] == 1
    assert first_page.json()["page"] == 1
    assert first_page.json()["page_count"] == 2
    assert len(first_page.json()["items"]) == 1

    second_page = client.get("/api/v1/admin/users?q=Amelie&limit=1&offset=1", headers=headers)

    assert second_page.status_code == 200, second_page.text
    assert second_page.json()["total"] == 2
    assert {item["id"] for item in first_page.json()["items"] + second_page.json()["items"]} == {first.id, second.id}


def test_admin_user_search_matches_name_and_email(client):
    headers = admin_headers()
    named = create_user(email="named@example.com", full_name="Marie Curie")
    emailed = create_user(email="contact-search@example.com", full_name="Ada Lovelace")

    for query, expected_id in [("Marie", named.id), ("Curie", named.id), ("contact-search", emailed.id)]:
        response = client.get(f"/api/v1/admin/users?q={query}", headers=headers)

        assert response.status_code == 200, response.text
        assert [item["id"] for item in response.json()["items"]] == [expected_id]


def test_admin_user_search_treats_like_wildcards_as_literal_text(client):
    headers = admin_headers()
    literal = create_user(email="literal_100@example.com", full_name="Literal")
    create_user(email="literalx100@example.com", full_name="Wildcard match")

    response = client.get("/api/v1/admin/users?q=literal_100", headers=headers)

    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()["items"]] == [literal.id]


def test_admin_user_detail_includes_safe_account_information_and_last_login(client):
    headers = admin_headers()
    user = create_user(email="detail@example.com", full_name="Detail User")
    with SessionLocal() as db:
        db.add(AuditLog(user_id=user.id, action="auth.login", data={}))
        db.commit()

    response = client.get(f"/api/v1/admin/users/{user.id}", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == user.id
    assert body["email"] == "detail@example.com"
    assert body["full_name"] == "Detail User"
    assert body["role"] == "user"
    assert body["is_active"] is True
    assert body["last_login_at"] is not None
    assert "password_hash" not in body


def test_admin_user_detail_returns_404_and_admin_lists_require_admin_authentication(client, auth_headers):
    headers = admin_headers()

    assert client.get(f"/api/v1/admin/users/{uuid4()}", headers=headers).status_code == 404
    assert client.get("/api/v1/admin/users").status_code == 401
    assert client.get("/api/v1/admin/users", headers=auth_headers).status_code == 403
    assert client.get(f"/api/v1/admin/users/{uuid4()}", headers=auth_headers).status_code == 403


def test_admin_user_360_task_and_service_request_filters_do_not_leak_other_users_data(client):
    headers = admin_headers()
    owner = create_user(email="owner@example.com", full_name="Owner")
    other = create_user(email="other-owner@example.com", full_name="Other Owner")
    with SessionLocal() as db:
        owner_task = Task(user_id=owner.id, title="Owner task", status="CONFIRMED")
        other_task = Task(user_id=other.id, title="Other task", status="DRAFT")
        db.add_all([owner_task, other_task])
        db.flush()
        db.add_all(
            [
                ServiceRequest(user_id=owner.id, task_id=owner_task.id, status="PREPARED", data={"category": "plumbing"}),
                ServiceRequest(user_id=other.id, task_id=other_task.id, status="CONFIRMED", data={"category": "cleaning"}),
            ]
        )
        db.commit()

    tasks = client.get(f"/api/v1/admin/tasks?user_id={owner.id}", headers=headers)
    requests = client.get(f"/api/v1/admin/service-requests?user_id={owner.id}", headers=headers)

    assert tasks.status_code == 200, tasks.text
    assert [item["title"] for item in tasks.json()["items"]] == ["Owner task"]
    assert requests.status_code == 200, requests.text
    assert [item["user_id"] for item in requests.json()["items"]] == [owner.id]


def test_admin_user_search_and_pagination_parameters_are_validated(client):
    headers = admin_headers()

    assert client.get("/api/v1/admin/users?limit=0", headers=headers).status_code == 422
    assert client.get("/api/v1/admin/users?offset=-1", headers=headers).status_code == 422
    assert client.get(f"/api/v1/admin/users?q={'x' * 161}", headers=headers).status_code == 422
