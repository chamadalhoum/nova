from pathlib import Path


def test_v06_api_error_shape_includes_request_id(client):
    response = client.get("/api/v1/tasks/not-a-task", headers={"X-Request-ID": "req-v06-contract-1"})
    assert response.status_code == 401
    assert response.headers["X-Request-ID"] == "req-v06-contract-1"
    body = response.json()
    assert body["error"]["code"] == "HTTP_ERROR"
    assert body["error"]["message"] == "Authentication required"
    assert body["error"]["request_id"] == "req-v06-contract-1"
    assert body["detail"] == body["error"]["message"]


def test_v06_provider_shape_matches_contract(client):
    response = client.get("/api/v1/providers")
    assert response.status_code == 200
    provider = response.json()[0]
    assert {
        "id",
        "name",
        "description",
        "location",
        "verified",
        "demo",
        "rating",
        "review_count",
        "services",
        "is_demo",
        "availability",
        "price",
        "category",
    }.issubset(provider)
    assert provider["is_demo"] is True
    assert provider["availability"] is None
    assert provider["price"] is None


def test_v06_error_envelope_preserves_structured_detail(client, auth_headers):
    response = client.get(
        "/api/v1/service-discovery?category=plumbing&location=",
        headers={**auth_headers, "X-Request-ID": "req-v06-contract-409"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "CAPABILITY_MISSING_INPUTS"
    assert body["error"]["request_id"] == "req-v06-contract-409"
    assert body["detail"]["code"] == "capability_missing_inputs"


def test_v06_validation_error_envelope_preserves_fastapi_detail(client):
    response = client.post("/api/v1/auth/register", json={}, headers={"X-Request-ID": "req-v06-contract-422"})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["request_id"] == "req-v06-contract-422"
    assert isinstance(body["detail"], list)
    assert body["detail"]


def test_v06_task_update_event_matches_contract(client, auth_headers):
    created = client.post("/api/v1/tasks", json={"title": "Contract task"}, headers=auth_headers)
    assert created.status_code == 201
    updated = client.patch(
        f"/api/v1/tasks/{created.json()['id']}",
        json={"title": "Updated contract task"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["events"][-1]["event_type"] == "updated"


def test_v06_shared_contract_contains_backend_statuses_and_events():
    contract = Path(__file__).parents[2] / "packages" / "contracts" / "src" / "index.ts"
    source = contract.read_text()
    for value in ["DRAFT", "NEEDS_INFO", "PLANNED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"]:
        assert f'"{value}"' in source
    for value in [
        "created",
        "clarification_requested",
        "information_received",
        "plan_created",
        "confirmation_requested",
        "confirmed",
        "updated",
        "started",
        "completed",
        "cancelled",
        "service_options_found",
        "provider_selected",
        "service_request_prepared",
        "service_request_confirmed",
    ]:
        assert f'"{value}"' in source
    assert '"PREPARED"' in source
    assert '"CONFIRMED"' in source
    assert "NovaApiErrorBody" in source
