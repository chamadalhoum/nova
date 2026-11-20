def test_natural_request_to_task_completion(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    assert conversation.status_code == 201
    conversation_id = conversation.json()["id"]

    first = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "N7eb wa7ed ysala7li l clim ghodwa"},
        headers=auth_headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["state"] == "needs_info"
    assert "Fi anéhi ville ou zone" in first.json()["assistant_message"]["content"]

    second = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "Ariana"},
        headers=auth_headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["state"] == "waiting_confirmation"
    assert second.json()["proposed_task"]["category"] == "air_conditioning"

    task_response = client.post(
        f"/api/v1/conversations/{conversation_id}/confirm-task", headers=auth_headers
    )
    assert task_response.status_code == 200, task_response.text
    task = task_response.json()
    assert task["status"] == "CONFIRMED"
    event_types = [event["event_type"] for event in task["events"]]
    assert event_types == [
        "created",
        "clarification_requested",
        "information_received",
        "plan_created",
        "confirmation_requested",
        "confirmed",
    ]

    listed = client.get("/api/v1/tasks", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == task["id"]

    completed = client.post(f"/api/v1/tasks/{task['id']}/complete", headers=auth_headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "COMPLETED"


def test_task_ownership(client, auth_headers):
    created = client.post("/api/v1/tasks", json={"title": "Private task"}, headers=auth_headers)
    assert created.status_code == 201
    task_id = created.json()["id"]

    other = client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "secretpass123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    denied = client.get(f"/api/v1/tasks/{task_id}", headers=other_headers)
    assert denied.status_code == 404


def test_user_owned_resources_are_isolated(client, auth_headers):
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "password": "secretpass123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    conversation_id = conversation.json()["id"]
    assert client.get(f"/api/v1/conversations/{conversation_id}", headers=other_headers).status_code == 404
    assert (
        client.post(
            f"/api/v1/conversations/{conversation_id}/messages",
            json={"content": "N7eb plombier fi Ariana"},
            headers=other_headers,
        ).status_code
        == 404
    )

    memory = client.post(
        "/api/v1/memories",
        json={"type": "user_preference", "key": "language", "value": "fr"},
        headers=auth_headers,
    )
    assert client.delete(f"/api/v1/memories/{memory.json()['id']}", headers=other_headers).status_code == 404
    assert client.get("/api/v1/memories", headers=other_headers).json() == []

    asset = client.post("/api/v1/assets", json={"name": "Washer"}, headers=auth_headers)
    assert asset.status_code == 201
    assert client.get("/api/v1/assets", headers=other_headers).json() == []


def test_invalid_task_transition_returns_friendly_error(client, auth_headers):
    task = client.post("/api/v1/tasks", json={"title": "Already cancelled"}, headers=auth_headers).json()
    cancelled = client.post(f"/api/v1/tasks/{task['id']}/cancel", headers=auth_headers)
    assert cancelled.status_code == 200
    completed = client.post(f"/api/v1/tasks/{task['id']}/complete", headers=auth_headers)
    assert completed.status_code == 409
    assert "cannot move" in completed.json()["detail"].lower()
