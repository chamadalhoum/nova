def service_provider_id(client, auth_headers, category: str = "air_conditioning", location: str = "Ariana") -> str:
    response = client.get(
        f"/api/v1/service-discovery?category={category}&location={location}",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["results"]
    return response.json()["results"][0]["id"]


def create_service_task(client, auth_headers) -> dict:
    response = client.post(
        "/api/v1/tasks",
        json={
            "title": "Repair AC",
            "category": "air_conditioning",
            "intent": "service_request",
            "data": {"entities": {"location": "Ariana"}, "constraints": []},
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_repeated_provider_selection_reuses_current_service_request(client, auth_headers):
    task = create_service_task(client, auth_headers)
    provider_id = service_provider_id(client, auth_headers)

    first = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": provider_id},
        headers=auth_headers,
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    first_request_id = first_body["data"]["service_request"]["id"]

    second = client.post(
        f"/api/v1/tasks/{task['id']}/select-provider",
        json={"provider_id": provider_id},
        headers=auth_headers,
    )
    assert second.status_code == 200, second.text
    second_body = second.json()
    assert second_body["data"]["service_request"]["id"] == first_request_id
    assert [event["event_type"] for event in second_body["events"]].count("service_request_prepared") == 1


def test_repeated_task_scoped_service_request_create_reuses_current_request(client, auth_headers):
    task = create_service_task(client, auth_headers)
    provider_id = service_provider_id(client, auth_headers)
    payload = {"task_id": task["id"], "provider_id": provider_id}

    first = client.post("/api/v1/service-requests", json=payload, headers=auth_headers)
    assert first.status_code == 201, first.text
    second = client.post("/api/v1/service-requests", json=payload, headers=auth_headers)
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first.json()["id"]
    assert "already prepared" in second.json()["message"]


def test_repeated_task_completion_does_not_duplicate_event(client, auth_headers):
    task = client.post("/api/v1/tasks", json={"title": "Done once"}, headers=auth_headers)
    assert task.status_code == 201, task.text

    first = client.post(f"/api/v1/tasks/{task.json()['id']}/complete", headers=auth_headers)
    assert first.status_code == 200, first.text
    second = client.post(f"/api/v1/tasks/{task.json()['id']}/complete", headers=auth_headers)
    assert second.status_code == 200, second.text
    assert [event["event_type"] for event in second.json()["events"]].count("completed") == 1


def test_repeated_cancel_does_not_duplicate_event(client, auth_headers):
    task = client.post("/api/v1/tasks", json={"title": "Cancel once"}, headers=auth_headers)
    assert task.status_code == 201, task.text

    first = client.post(f"/api/v1/tasks/{task.json()['id']}/cancel", headers=auth_headers)
    assert first.status_code == 200, first.text
    second = client.post(f"/api/v1/tasks/{task.json()['id']}/cancel", headers=auth_headers)
    assert second.status_code == 200, second.text
    assert [event["event_type"] for event in second.json()["events"]].count("cancelled") == 1
