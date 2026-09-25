def test_memory_create_read_delete(client, auth_headers):
    created = client.post(
        "/api/v1/memories",
        json={"type": "user_preference", "key": "language", "value": "fr"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    memory_id = created.json()["id"]

    listed = client.get("/api/v1/memories", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["key"] == "language"

    deleted = client.delete(f"/api/v1/memories/{memory_id}", headers=auth_headers)
    assert deleted.status_code == 204


def test_providers_are_demo_flagged(client):
    categories = client.get("/api/v1/service-categories")
    assert categories.status_code == 200
    assert any(category["slug"] == "air_conditioning" for category in categories.json())

    providers = client.get("/api/v1/providers?category=air_conditioning")
    assert providers.status_code == 200
    assert providers.json()
    assert providers.json()[0]["demo"] is True
    assert providers.json()[0]["rating"] is None


def test_service_request_requires_confirmation_and_logs_tool(client, auth_headers):
    created = client.post(
        "/api/v1/tasks",
        json={"title": "Find AC provider", "category": "air_conditioning", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    )
    task_id = created.json()["id"]
    request = client.post(
        "/api/v1/service-requests",
        json={"task_id": task_id, "note": "Search only"},
        headers=auth_headers,
    )
    assert request.status_code == 201
    body = request.json()
    assert body["status"] == "PREPARED"
    assert body["risk_level"] == "LOW"
    assert "No external provider was contacted or booked" in body["message"]
