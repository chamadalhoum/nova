from app.core.database import SessionLocal
from app.models import AuditLog
from tests.test_admin_v07 import make_admin_headers


def test_admin_ai_filters_and_intelligence_metrics_use_only_processed_events(client):
    headers = make_admin_headers(client)
    with SessionLocal() as db:
        db.add_all([
            AuditLog(action="ai.intent_processed", data={"provider": "openai", "model": "mini", "intent": "repair", "success": True, "fallback_used": False, "latency_ms": 100}),
            AuditLog(action="ai.intent_processed", data={"provider": "openai", "model": "mini", "intent": "repair", "success": False, "fallback_used": True, "latency_ms": 300}),
            AuditLog(action="ai.question_asked", data={"intent": "repair"}),
        ])
        db.commit()

    filtered = client.get("/api/v1/admin/ai-events?provider=openai&success=true", headers=headers)
    metrics = client.get("/api/v1/admin/intelligence?days=7", headers=headers)

    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert metrics.status_code == 200, metrics.text
    body = metrics.json()
    assert body["ai"]["total"] == 2
    assert body["ai"]["success_rate"] == 50
    assert body["ai"]["fallback_rate"] == 50
    assert body["ai"]["average_latency_ms"] == 200


def test_admin_audit_filters_require_admin(client, auth_headers):
    headers = make_admin_headers(client)
    with SessionLocal() as db:
        db.add(AuditLog(action="product.task_created", data={"status": "CONFIRMED"}))
        db.commit()

    assert client.get("/api/v1/admin/audit-logs?q=task&start_at=invalid", headers=headers).status_code == 422
    assert client.get("/api/v1/admin/audit-logs?q=task", headers=headers).json()["total"] == 1
    assert client.get("/api/v1/admin/intelligence").status_code == 401
    assert client.get("/api/v1/admin/intelligence", headers=auth_headers).status_code == 403
