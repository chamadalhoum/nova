from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import AuditLog, TaskEvent


def create_confirmed_service_task(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    assert conversation.status_code == 201, conversation.text
    conversation_id = conversation.json()["id"]

    first = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "N7eb plombier ghodwa"},
        headers=auth_headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["state"] == "needs_info"

    second = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "Ariana"},
        headers=auth_headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["state"] == "waiting_confirmation"
    assert second.json()["intent"]["intent"] == "service_request"
    assert second.json()["intent"]["category"] == "plumbing"
    assert second.json()["proposed_task"]["location"] == "Ariana"

    task = client.post(f"/api/v1/conversations/{conversation_id}/confirm-task", headers=auth_headers)
    assert task.status_code == 200, task.text
    return task.json()


def test_v04_end_to_end_service_request_flow(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    task_id = task["id"]

    search = client.post(f"/api/v1/tasks/{task_id}/search-services", headers=auth_headers)
    assert search.status_code == 200, search.text
    provider = search.json()["results"][0]
    assert provider["is_demo"] is True
    assert provider["availability"] is None
    assert provider["price"] is None

    selection = client.post(
        f"/api/v1/tasks/{task_id}/select-provider",
        json={"provider_id": provider["id"]},
        headers=auth_headers,
    )
    assert selection.status_code == 200, selection.text
    selected_task = selection.json()
    service_request = selected_task["data"]["service_request"]
    assert selected_task["data"]["selected_provider"]["id"] == provider["id"]
    assert service_request["status"] == "PREPARED"

    prepared = client.get(f"/api/v1/service-requests/{service_request['id']}", headers=auth_headers)
    assert prepared.status_code == 200, prepared.text
    assert prepared.json()["status"] == "PREPARED"
    assert prepared.json()["data"]["external_action_executed"] is False

    confirmed = client.post(f"/api/v1/service-requests/{service_request['id']}/confirm", headers=auth_headers)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "CONFIRMED"
    assert confirmed.json()["data"]["external_action_executed"] is False

    final_task = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert final_task["status"] == "CONFIRMED"
    assert final_task["data"]["service_request"]["status"] == "CONFIRMED"
    event_types = [event["event_type"] for event in final_task["events"]]
    assert event_types == [
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
    ]


def test_v04_select_provider_rejects_wrong_category(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Need AC", "category": "air_conditioning", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    plumbing_provider = client.get("/api/v1/providers?category=plumbing").json()[0]

    response = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": plumbing_provider["id"]},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_v04_select_provider_rejects_wrong_location(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Need plumber", "category": "plumbing", "data": {"entities": {"location": "Paris"}}},
        headers=auth_headers,
    ).json()
    provider = client.get("/api/v1/providers?category=plumbing").json()[0]

    response = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": provider["id"]},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_v04_select_provider_rejects_unknown_provider(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Need plumber", "category": "plumbing", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    response = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": "missing"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_v04_select_provider_enforces_task_ownership(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Private", "category": "plumbing", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    provider = client.get("/api/v1/providers?category=plumbing").json()[0]
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "v04-other@example.com", "password": "secretpass123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": provider["id"]},
        headers=other_headers,
    )
    assert response.status_code == 404


def test_v04_service_request_confirmation_enforces_ownership(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    search = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=auth_headers).json()
    selected = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": search["results"][0]["id"]},
        headers=auth_headers,
    ).json()
    service_request_id = selected["data"]["service_request"]["id"]
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "v04-request-other@example.com", "password": "secretpass123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = client.post(f"/api/v1/service-requests/{service_request_id}/confirm", headers=other_headers)
    assert response.status_code == 404


def test_v04_product_events_are_sanitized(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    search = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=auth_headers).json()
    selected = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": search["results"][0]["id"]},
        headers=auth_headers,
    ).json()
    client.post(f"/api/v1/service-requests/{selected['data']['service_request']['id']}/confirm", headers=auth_headers)

    db = SessionLocal()
    try:
        events = db.scalars(select(AuditLog).where(AuditLog.action.like("product.%"))).all()
        names = {event.action for event in events}
        assert "product.intent_detected" in names
        assert "product.provider_selected" in names
        assert "product.service_request_confirmed" in names
        serialized = str([event.data for event in events])
        assert "N7eb plombier" not in serialized
        assert "Ariana" not in serialized
    finally:
        db.close()


def test_v04_timeline_contains_only_real_service_events(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    db = SessionLocal()
    try:
        events = db.scalars(select(TaskEvent).where(TaskEvent.task_id == task["id"])).all()
        assert [event.event_type for event in events] == [
            "created",
            "clarification_requested",
            "information_received",
            "plan_created",
            "confirmation_requested",
            "confirmed",
        ]
    finally:
        db.close()


def test_v04_direct_service_request_with_valid_provider_updates_task(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Need plumber", "category": "plumbing", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    provider = client.get("/api/v1/providers?category=plumbing").json()[0]
    response = client.post(
        "/api/v1/service-requests",
        json={"task_id": task["id"], "provider_id": provider["id"], "note": "Prepare only"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "PREPARED"

    task_after = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers).json()
    assert task_after["data"]["selected_provider"]["id"] == provider["id"]
    assert task_after["data"]["service_request"]["status"] == "PREPARED"
    assert task_after["events"][-1]["event_type"] == "service_request_prepared"


def test_v04_service_request_confirmation_is_idempotent_and_not_booked(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    search = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=auth_headers).json()
    selected = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": search["results"][0]["id"]},
        headers=auth_headers,
    ).json()
    request_id = selected["data"]["service_request"]["id"]

    first = client.post(f"/api/v1/service-requests/{request_id}/confirm", headers=auth_headers)
    task_after_first = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers).json()
    second = client.post(f"/api/v1/service-requests/{request_id}/confirm", headers=auth_headers)
    task_after_second = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers).json()
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["status"] == "CONFIRMED"
    assert second.json()["data"]["external_action_executed"] is False
    assert [event["event_type"] for event in task_after_first["events"]] == [
        event["event_type"] for event in task_after_second["events"]
    ]


def test_v04_task_timeline_never_uses_booked_event(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    search = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=auth_headers).json()
    selected = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": search["results"][0]["id"]},
        headers=auth_headers,
    ).json()
    client.post(f"/api/v1/service-requests/{selected['data']['service_request']['id']}/confirm", headers=auth_headers)

    final_task = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers).json()
    event_types = [event["event_type"] for event in final_task["events"]]
    assert "booked" not in event_types
    assert "booking_confirmed" not in event_types


def test_v04_stale_service_request_cannot_overwrite_current_selection(client, auth_headers):
    task = create_confirmed_service_task(client, auth_headers)
    search = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=auth_headers).json()
    provider = search["results"][0]

    first = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": provider["id"]},
        headers=auth_headers,
    ).json()
    first_request_id = first["data"]["service_request"]["id"]
    second = client.post(
        "/api/v1/service-requests",
        json={"task_id": task["id"], "provider_id": provider["id"], "note": "newer request"},
        headers=auth_headers,
    ).json()

    stale = client.post(f"/api/v1/service-requests/{first_request_id}/confirm", headers=auth_headers)
    assert stale.status_code == 409

    current = client.post(f"/api/v1/service-requests/{second['id']}/confirm", headers=auth_headers)
    assert current.status_code == 200, current.text
    final_task = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers).json()
    assert final_task["data"]["service_request"]["id"] == second["id"]
    assert final_task["data"]["service_request"]["status"] == "CONFIRMED"
