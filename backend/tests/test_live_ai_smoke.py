import os

import pytest

from app.ai.pipeline import NovaAIPipeline


@pytest.mark.asyncio
async def test_live_ai_smoke_optional() -> None:
    if os.getenv("RUN_LIVE_AI_SMOKE") != "1" or not os.getenv("AI_API_KEY"):
        pytest.skip("Live AI smoke test requires RUN_LIVE_AI_SMOKE=1 and AI_API_KEY")

    result = await NovaAIPipeline().run_async(
        "N7eb wa7ed ysala7li l clim demain fi Ariana",
        {"locale": "fr", "timezone": "UTC"},
    )
    assert result.intent.intent == "service_request"
    assert result.intent.category == "air_conditioning"
    assert result.intent.entities.get("location") == "Ariana"
    assert result.metadata.provider != "deterministic"
