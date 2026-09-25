import pytest

from app.ai.pipeline import DateNormalizer, NovaAIPipeline
from app.ai.provider import AIProviderError, OpenAIProvider, openai_intent_schema
from app.ai.schemas import AIExecutionMetadata, IntentResult


class FakeAIProvider:
    def __init__(self, intent: IntentResult) -> None:
        self.intent = intent

    async def generate(self, prompt: str, context: dict | None = None) -> str:
        return prompt

    async def classify(
        self, text: str, context: dict | None = None
    ) -> tuple[IntentResult, AIExecutionMetadata]:
        return self.intent, AIExecutionMetadata(provider="fake", model="fake-intent", latency_ms=3)

    async def embed(self, text: str) -> list[float]:
        return [0.0]


class FailingAIProvider:
    async def generate(self, prompt: str, context: dict | None = None) -> str:
        return prompt

    async def classify(
        self, text: str, context: dict | None = None
    ) -> tuple[IntentResult, AIExecutionMetadata]:
        raise AIProviderError("provider unavailable")

    async def embed(self, text: str) -> list[float]:
        return []


class TimeoutAIProvider(FailingAIProvider):
    async def classify(
        self, text: str, context: dict | None = None
    ) -> tuple[IntentResult, AIExecutionMetadata]:
        raise AIProviderError("provider timeout")


class InvalidOutputAIProvider(FailingAIProvider):
    async def classify(
        self, text: str, context: dict | None = None
    ) -> tuple[IntentResult, AIExecutionMetadata]:
        raise AIProviderError("AI provider returned invalid structured output")


@pytest.mark.asyncio
async def test_fake_provider_structured_intent_flows_to_task_plan():
    intent = IntentResult(
        intent="service_request",
        category="air_conditioning",
        language="mixed",
        entities={
            "location": "Ariana",
            "date_expression": "tomorrow",
            "time_period": "afternoon",
        },
        constraints=["low_budget_preference"],
        missing_fields=[],
        confidence=0.92,
        next_action="search_providers",
    )
    pipeline = NovaAIPipeline(provider=FakeAIProvider(intent))
    result = await pipeline.run_async(
        "N7eb wa7ed ysala7li l clim demain fi Ariana, preferably l'après-midi w ma n7ebbech nخلص barcha.",
        {},
    )
    assert result.state == "waiting_confirmation"
    assert result.intent.intent == "service_request"
    assert result.intent.category == "air_conditioning"
    assert result.proposed_task is not None
    assert result.proposed_task.due_date == DateNormalizer().normalize("tomorrow")
    assert "low_budget_preference" in result.proposed_task.constraints
    assert result.metadata.provider == "fake"


@pytest.mark.asyncio
async def test_provider_failure_uses_deterministic_fallback():
    pipeline = NovaAIPipeline(provider=FailingAIProvider())
    result = await pipeline.run_async("Need someone to fix my AC tomorrow", {})
    assert result.intent.intent == "service_request"
    assert result.intent.category == "air_conditioning"
    assert result.metadata.fallback_used is True
    assert result.metadata.error_type == "AIProviderError"


def test_intent_schema_rejects_arbitrary_fields():
    with pytest.raises(ValueError):
        IntentResult.model_validate(
            {
                "intent": "service_request",
                "category": "air_conditioning",
                "language": "en",
                "entities": {},
                "missing_fields": [],
                "confidence": 0.9,
                "secret_tool": "run_shell",
            }
        )


def test_deterministic_mixed_language_examples():
    pipeline = NovaAIPipeline()
    examples = [
        "N7eb wa7ed ysala7li l clim demain fi Ariana.",
        "Je veux un plombier ghodwa fi La Marsa.",
        "Can you findli wa7ed pour réparer la machine?",
        "نحب نلقى technicien fi Tunis.",
    ]
    results = [pipeline.run(text, {}) for text in examples]
    assert results[0].intent.intent == "service_request"
    assert results[0].intent.category == "air_conditioning"
    assert results[0].intent.entities["location"] == "Ariana"
    assert results[1].intent.category == "plumbing"


def test_product_search_and_appointment_are_not_forced_to_service_request():
    pipeline = NovaAIPipeline()
    product = pipeline.run("N7eb nechri machine à laver behia w ma tetkalefch barcha.", {})
    appointment = pipeline.run("N7eb n7جز rendez-vous.", {})
    assert product.intent.intent == "product_search"
    assert product.intent.category == "appliance"
    assert appointment.intent.intent == "appointment"
    assert appointment.state == "needs_info"


def test_low_confidence_unknown_asks_for_description():
    pipeline = NovaAIPipeline()
    result = pipeline.run("ma na3rach chnowa na3mel", {})
    assert result.intent.intent == "unknown"
    assert result.state == "needs_info"
    assert "describe" in result.response.lower()


def test_v03_service_request_suggests_search_services_capability():
    result = NovaAIPipeline().run("N7eb plombier fi Ariana ghodwa", {})
    assert result.state == "waiting_confirmation"
    assert result.intent.next_action == "search_services"
    assert result.intent.suggested_capability == "search_services"
    assert result.proposed_task is not None
    assert result.proposed_task.suggested_capability == "search_services"
    assert result.proposed_task.metadata["next_capability"] == "search_services"


def test_v03_non_service_requests_do_not_search_services():
    pipeline = NovaAIPipeline()
    product = pipeline.run("I want to buy a washing machine.", {})
    appointment = pipeline.run("I need to book an appointment.", {})
    assert product.intent.intent == "product_search"
    assert product.intent.suggested_capability == "create_task"
    assert appointment.intent.intent == "appointment"
    assert appointment.state == "needs_info"
    assert appointment.intent.suggested_capability is None


def test_v04_multilingual_plumbing_requests_map_to_service_discovery():
    pipeline = NovaAIPipeline()
    examples = [
        "N7eb plombier fi Ariana ghodwa",
        "Je cherche un plombier à Ariana demain.",
        "I need a plumber in Ariana tomorrow.",
        "نحب سباك في أريانة غدوة",
    ]
    results = [pipeline.run(text, {}) for text in examples]
    for result in results:
        assert result.state == "waiting_confirmation"
        assert result.intent.intent == "service_request"
        assert result.intent.category == "plumbing"
        assert result.intent.entities["location"] == "Ariana"
        assert result.intent.suggested_capability == "search_services"
        assert result.proposed_task is not None
        assert result.proposed_task.location == "Ariana"


def test_v05_openai_schema_is_strict_and_explicit():
    schema = openai_intent_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(schema["properties"])
    assert schema["properties"]["category"]["type"] == ["string", "null"]
    assert schema["properties"]["entities"]["additionalProperties"] is False
    assert "location" in schema["properties"]["entities"]["required"]


def test_v05_openai_provider_requires_api_key():
    with pytest.raises(AIProviderError):
        OpenAIProvider("", "gpt-4o-mini", 1)


@pytest.mark.asyncio
async def test_v05_provider_timeout_uses_deterministic_fallback():
    result = await NovaAIPipeline(provider=TimeoutAIProvider()).run_async("I need a plumber in Ariana tomorrow", {})
    assert result.intent.intent == "service_request"
    assert result.intent.category == "plumbing"
    assert result.metadata.fallback_used is True
    assert result.metadata.error_type == "AIProviderError"


@pytest.mark.asyncio
async def test_v05_invalid_structured_output_uses_deterministic_fallback():
    result = await NovaAIPipeline(provider=InvalidOutputAIProvider()).run_async("Je cherche un plombier à Ariana demain", {})
    assert result.intent.intent == "service_request"
    assert result.intent.category == "plumbing"
    assert result.metadata.fallback_used is True
    assert result.metadata.error_type == "AIProviderError"
