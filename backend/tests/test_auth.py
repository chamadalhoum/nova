def test_register_login_refresh_and_me(client):
    register = client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "secretpass123", "full_name": "A"},
    )
    assert register.status_code == 201
    tokens = register.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "a@example.com"

    login = client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "secretpass123"}
    )
    assert login.status_code == 200

    bad_login = client.post(
        "/api/v1/auth/login", json={"email": "a@example.com", "password": "wrongpass"}
    )
    assert bad_login.status_code == 401

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200


def test_authorization_required(client):
    response = client.get("/api/v1/tasks")
    assert response.status_code == 401
