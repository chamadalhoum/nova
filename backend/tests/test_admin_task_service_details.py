from app.core.database import SessionLocal
from app.models import ServiceRequest, Task, TaskEvent
from tests.test_admin_v07 import make_admin_headers


def test_admin_can_view_safe_task_and_service_request_details(client, auth_headers):
    owner = client.get("/api/v1/me", headers=auth_headers).json()
    with SessionLocal() as db:
        task = Task(user_id=owner["id"], title="Repair AC", status="CONFIRMED", data={"private": "hidden"})
        db.add(task)
        db.flush()
        db.add(TaskEvent(task_id=task.id, user_id=owner["id"], event_type="confirmed", message="Task confirmed", data={"private": "hidden"}))
        request = ServiceRequest(user_id=owner["id"], task_id=task.id, status="PREPARED", data={"category": "air_conditioning", "location": "Ariana"})
        db.add(request)
        db.commit()
        task_id, request_id = task.id, request.id

    headers = make_admin_headers(client)
    task_response = client.get(f"/api/v1/admin/tasks/{task_id}", headers=headers)
    request_response = client.get(f"/api/v1/admin/service-requests/{request_id}", headers=headers)

    assert task_response.status_code == 200, task_response.text
    assert task_response.json()["events"] == [{"event_type": "confirmed", "message": "Task confirmed", "created_at": task_response.json()["events"][0]["created_at"]}]
    assert "data" not in str(task_response.json())
    assert request_response.status_code == 200, request_response.text
    assert request_response.json()["task_id"] == task_id
    assert request_response.json()["category"] == "air_conditioning"


def test_task_and_service_request_details_require_admin_and_return_404(client, auth_headers):
    admin_headers = make_admin_headers(client)
    missing = "00000000-0000-0000-0000-000000000000"

    assert client.get(f"/api/v1/admin/tasks/{missing}", headers=admin_headers).status_code == 404
    assert client.get(f"/api/v1/admin/service-requests/{missing}", headers=admin_headers).status_code == 404
    assert client.get(f"/api/v1/admin/tasks/{missing}").status_code == 401
    assert client.get(f"/api/v1/admin/service-requests/{missing}", headers=auth_headers).status_code == 403
