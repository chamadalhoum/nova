from app.ai.pipeline import NovaAIPipeline


def test_multilingual_ac_requests_map_to_service_request():
    pipeline = NovaAIPipeline()
    examples = [
        "Répare ma clim demain",
        "N7eb wa7ed ysala7li l clim ghodwa",
        "Need someone to fix my AC tomorrow",
        "نحب واحد يصلحلي الكليم غدوة",
    ]
    for text in examples:
        result = pipeline.run(text, {})
        assert result.intent.intent == "service_request"
        assert result.intent.category == "air_conditioning"
        assert "location" in result.intent.missing_fields
        assert result.state == "needs_info"


def test_dynamic_location_answer_prepares_task():
    pipeline = NovaAIPipeline()
    first = pipeline.run("N7eb wa7ed ysala7li l clim ghodwa", {})
    second = pipeline.run("Ariana", first.context_update)
    assert second.state == "waiting_confirmation"
    assert second.proposed_task is not None
    assert second.proposed_task.title == "Repair air conditioner"
    assert second.intent.entities["location"] == "Ariana"
