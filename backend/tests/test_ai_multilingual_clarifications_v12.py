import asyncio

import pytest

from app.ai.pipeline import NovaAIPipeline
from app.ai.provider import AIProviderError


@pytest.mark.parametrize(
    ("text", "expected_language", "expected_question"),
    [
        ("Je cherche un électricien demain.", "fr", "Dans quelle ville ou zone"),
        ("I need a plumber.", "en", "Which city or area"),
        ("أريد العثور على كهربائي", "ar", "أي مدينة أو منطقة"),
        ("نحب سباك", "tn", "في أنهي مدينة أو منطقة"),
        ("N7eb plombier", "arabizi", "Fi anéhi ville ou zone"),
        ("N7eb réparateur pour clim", "mixed", "ville ou zone"),
    ],
)
def test_location_clarifications_follow_the_message_language(text, expected_language, expected_question):
    result = NovaAIPipeline().run(text)

    assert result.state == "needs_info"
    assert result.intent.language == expected_language
    assert result.intent.missing_fields == ["location"]
    assert expected_question in result.response


def test_short_location_reply_completes_pending_intent_without_repeating_question():
    pipeline = NovaAIPipeline()
    first = pipeline.run("Je cherche un électricien demain.")

    second = pipeline.run("Hammamet", first.context_update)

    assert second.state == "waiting_confirmation"
    assert second.intent.entities["location"] == "Hammamet"
    assert "Dans quelle ville" not in second.response


def test_new_service_intent_replaces_pending_service_intent():
    pipeline = NovaAIPipeline()
    first = pipeline.run("Je cherche un plombier.")

    changed = pipeline.run("Finalement je veux un électricien à Hammamet.", first.context_update)

    assert changed.state == "waiting_confirmation"
    assert changed.intent.category == "electricity"
    assert changed.intent.entities["location"] == "Hammamet"


def test_fallback_keeps_localized_clarification_when_provider_is_unavailable():
    class UnavailableProvider:
        async def classify(self, text, context):
            raise AIProviderError("provider unavailable")

    result = asyncio.run(NovaAIPipeline(provider=UnavailableProvider()).run_async("Je cherche un électricien."))

    assert result.metadata.fallback_used is True
    assert result.state == "needs_info"
    assert "Dans quelle ville ou zone" in result.response
