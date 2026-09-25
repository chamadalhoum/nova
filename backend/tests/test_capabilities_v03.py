from app.capabilities.registry import CapabilityError, capability_registry


def test_capability_registry_metadata():
    search = capability_registry.validate_inputs(
        "search_services", {"category": "plumbing", "location": "Ariana"}
    )
    assert search.enabled is True
    assert search.risk_level == "READ_ONLY"
    assert search.confirmation_required is False

    create_task = capability_registry.get("create_task")
    assert create_task is not None
    assert create_task.risk_level == "LOW"
    assert create_task.confirmation_required is True


def test_disabled_and_unknown_capabilities_are_blocked():
    try:
        capability_registry.require_enabled("booking")
    except CapabilityError as exc:
        assert exc.code == "capability_disabled"
    else:
        raise AssertionError("booking must remain disabled")

    try:
        capability_registry.require_enabled("teleport")
    except CapabilityError as exc:
        assert exc.code == "capability_unknown"
    else:
        raise AssertionError("unknown capabilities must be rejected")


def test_capabilities_endpoint_exposes_safe_metadata(client):
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    capabilities = {item["name"]: item for item in response.json()}
    assert capabilities["search_services"]["enabled"] is True
    assert capabilities["search_services"]["risk_level"] == "READ_ONLY"
    assert capabilities["booking"]["enabled"] is False
    assert "implementation" not in capabilities["search_services"]


def test_service_discovery_requires_auth(client):
    response = client.get("/api/v1/service-discovery?category=plumbing&location=Ariana")
    assert response.status_code == 401


def test_service_discovery_returns_demo_results_without_fake_facts(client, auth_headers):
    response = client.get(
        "/api/v1/service-discovery?category=plumbing&location=Ariana", headers=auth_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["capability"] == "search_services"
    assert body["is_demo"] is True
    assert body["results"]
    result = body["results"][0]
    assert result["category"] == "plumbing"
    assert result["is_demo"] is True
    assert result["availability"] is None
    assert result["rating"] is None
    assert result["price"] is None
    assert "No real-time availability" in result["message"] or "no real-time availability" in result["message"]


def test_service_discovery_is_location_scoped(client, auth_headers):
    response = client.get(
        "/api/v1/service-discovery?category=plumbing&location=Paris", headers=auth_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["results"] == []


def test_service_discovery_location_wildcards_do_not_match_all(client, auth_headers):
    response = client.get(
        "/api/v1/service-discovery?category=plumbing&location=%25", headers=auth_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["results"] == []


def test_service_discovery_missing_location_is_rejected(client, auth_headers):
    response = client.get("/api/v1/service-discovery?category=plumbing&location=", headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "capability_missing_inputs"


def test_service_discovery_whitespace_location_is_rejected(client, auth_headers):
    response = client.get("/api/v1/service-discovery?category=plumbing&location=%20%20", headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "capability_missing_inputs"


def test_task_scoped_service_search_uses_task_entities(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    conversation_id = conversation.json()["id"]
    message = client.post(
        f"/api/v1/conversations/{conversation_id}/messages",
        json={"content": "N7eb plombier fi Ariana ghodwa"},
        headers=auth_headers,
    )
    assert message.status_code == 200, message.text
    task = client.post(f"/api/v1/conversations/{conversation_id}/confirm-task", headers=auth_headers)
    task_id = task.json()["id"]

    response = client.post(f"/api/v1/tasks/{task_id}/search-services", headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["category"] == "plumbing"
    assert body["location"] == "Ariana"
    assert body["results"]

    task_after = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
    assert task_after["events"][-1]["event_type"] == "service_options_found"


def test_task_scoped_service_search_enforces_ownership(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Private", "category": "plumbing", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    other = client.post(
        "/api/v1/auth/register",
        json={"email": "cap-other@example.com", "password": "secretpass123"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    response = client.post(f"/api/v1/tasks/{task['id']}/search-services", headers=other_headers)
    assert response.status_code == 404


def test_prepare_service_request_is_prepared_not_booked(client, auth_headers):
    task = client.post(
        "/api/v1/tasks",
        json={"title": "Find plumber", "category": "plumbing", "data": {"entities": {"location": "Ariana"}}},
        headers=auth_headers,
    ).json()
    response = client.post(
        "/api/v1/service-requests",
        json={"task_id": task["id"], "note": "Prepare only"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "PREPARED"
    assert body["risk_level"] == "LOW"
    assert body["data"]["external_action_executed"] is False
    assert "No external provider was contacted or booked" in body["message"]


def test_prepare_service_request_missing_inputs_rejected(client, auth_headers):
    response = client.post("/api/v1/service-requests", json={"category": "plumbing"}, headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "capability_missing_inputs"


def test_prepare_service_request_whitespace_location_rejected(client, auth_headers):
    response = client.post(
        "/api/v1/service-requests",
        json={"category": "plumbing", "location": "  "},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "capability_missing_inputs"


def test_prepare_service_request_rejects_unknown_provider(client, auth_headers):
    response = client.post(
        "/api/v1/service-requests",
        json={"category": "plumbing", "location": "Ariana", "provider_id": "missing-provider"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_prepare_service_request_rejects_provider_in_wrong_location(client, auth_headers):
    providers = client.get("/api/v1/providers?category=plumbing").json()
    provider_id = providers[0]["id"]
    response = client.post(
        "/api/v1/service-requests",
        json={"category": "plumbing", "location": "Paris", "provider_id": provider_id},
        headers=auth_headers,
    )
    assert response.status_code == 422
