import asyncio
from pathlib import Path

from sqlalchemy import select

from app.ai.memory_evaluation import (
    evaluate_memory_conversation_cases,
    load_memory_conversation_cases,
)
from app.ai.pipeline import NovaAIPipeline
from app.ai.schemas import AIExecutionMetadata, IntentResult
from app.core.database import SessionLocal
from app.models import AuditLog, Memory, User

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ai_memory_conversation_eval.json"


def test_comparative_memory_dataset_is_deterministic_and_multilingual():
    cases = load_memory_conversation_cases(FIXTURE_PATH)
    report = evaluate_memory_conversation_cases(cases)

    assert len(cases) >= 12
    assert {case.language for case in cases} == {"fr", "en", "ar", "tn", "arabizi", "mixed"}
    assert report.without_memory.intent_accuracy.value == 1.0
    assert report.with_memory.intent_accuracy.value == 1.0
    assert report.with_memory.memory_misuse_rate.value == 0.0
    assert report.with_memory.unsupported_assumption_rate.value == 0.0
    assert report.with_memory.repeated_clarification_rate.value == 0.0
    assert report.with_memory.fallback_consistency.value == 1.0
    assert report.with_memory.memory_relevance.value is None


def test_memory_location_provenance_guard_rejects_provider_only_location():
    class LocationLeakingProvider:
        async def classify(self, text, context):
            return (
                IntentResult(
                    intent="service_request", category="electricity", language="fr",
                    entities={"location": "Tunis"}, missing_fields=[], confidence=0.95,
                    next_action="search_services", suggested_capability="search_services",
                ),
                AIExecutionMetadata(provider="controlled-test"),
            )

    result = asyncio.run(
        NovaAIPipeline(provider=LocationLeakingProvider()).run_async(
            "Je cherche un électricien.", {"memory_context": {"location_suggestion": "Tunis"}}
        )
    )

    assert result.state == "needs_info"
    assert "location" in result.intent.missing_fields
    assert "location" not in result.intent.entities


def test_memory_location_provenance_guard_prioritizes_current_message_location():
    class WrongLocationProvider:
        async def classify(self, text, context):
            return (
                IntentResult(
                    intent="service_request", category="electricity", language="fr",
                    entities={"location": "Tunis"}, missing_fields=[], confidence=0.95,
                    next_action="search_services", suggested_capability="search_services",
                ),
                AIExecutionMetadata(provider="controlled-test"),
            )

    result = asyncio.run(
        NovaAIPipeline(provider=WrongLocationProvider()).run_async(
            "Je cherche un électricien à Hammamet.",
            {"memory_context": {"location_suggestion": "Tunis"}},
        )
    )

    assert result.state == "waiting_confirmation"
    assert result.intent.entities["location"] == "Hammamet"


def test_audit_records_only_aggregate_memory_metadata(client, auth_headers):
    token = auth_headers["Authorization"].removeprefix("Bearer ")
    from app.core.config import settings
    from app.core.security import decode_token

    user_id = decode_token(token, settings.jwt_secret, "access")["sub"]
    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        db.add_all([
            Memory(user_id=user.id, type="user_preference", key="language", value="fr"),
            Memory(user_id=user.id, type="user_preference", key="preferred_location", value="Tunis"),
        ])
        db.commit()

    conversation = client.post("/api/v1/conversations", json={}, headers=auth_headers).json()
    response = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        json={"content": "Je cherche un plombier."}, headers=auth_headers,
    )

    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        event = db.scalar(select(AuditLog).where(AuditLog.action == "ai.intent_processed"))
        assert event is not None
        assert event.data["memory_context_used"] is True
        assert event.data["memory_context_count"] == 2
        assert event.data["memory_context_categories"] == ["language", "location"]
        assert "Tunis" not in str(event.data)
        assert "language_preference" not in event.data
        assert "location_suggestion" not in event.data
