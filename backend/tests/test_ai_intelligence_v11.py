import pytest
from sqlalchemy import select

from app.ai.evaluation import EvaluationCase, evaluate_intent_cases
from app.ai.pipeline import NovaAIPipeline
from app.ai.provider import INTENT_PROMPT_VERSION, AIProviderError
from app.core.database import SessionLocal
from app.models import AuditLog


class FailingProvider:
    async def classify(self, text: str, context: dict | None = None):
        raise AIProviderError("provider unavailable")


def test_multilingual_evaluation_reports_explicit_quality_metrics():
    report = evaluate_intent_cases(
        [
            EvaluationCase("en", "I need a plumber in Ariana", "service_request", "plumbing"),
            EvaluationCase("fr", "Je veux réparer ma clim à Tunis", "service_request", "air_conditioning"),
            EvaluationCase("ar", "نحب سباك في أريانة", "service_request", "plumbing"),
        ]
    )

    assert report.total == 3
    assert report.intent_accuracy == 1.0
    assert report.category_accuracy == 1.0
    assert report.by_language["en"].total == 1
    assert report.by_language["fr"].intent_accuracy == 1.0


@pytest.mark.asyncio
async def test_ai_execution_metadata_versions_prompts_and_records_fallback_performance():
    result = await NovaAIPipeline(provider=FailingProvider()).run_async("Need a plumber in Ariana", {})

    assert result.metadata.prompt_version == INTENT_PROMPT_VERSION
    assert result.metadata.fallback_used is True
    assert result.metadata.fallback_from_provider == "failingprovider"
    assert result.metadata.total_latency_ms is not None
    assert result.metadata.total_latency_ms >= result.metadata.latency_ms


def test_ai_audit_metadata_persists_prompt_version_without_user_content(client, auth_headers):
    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers)
    response = client.post(
        f"/api/v1/conversations/{conversation.json()['id']}/messages",
        json={"content": "Need a plumber in Ariana"},
        headers=auth_headers,
    )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        event = db.scalar(select(AuditLog).where(AuditLog.action == "ai.intent_processed"))
        assert event is not None
        assert event.data["prompt_version"] == INTENT_PROMPT_VERSION
        assert isinstance(event.data["total_latency_ms"], int)
        assert "Need a plumber" not in str(event.data)
