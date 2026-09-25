from app.ai.pipeline import NovaAIPipeline


def test_multi_turn_clarification_and_follow_up_updates_pending_task():
    pipeline = NovaAIPipeline()
    first = pipeline.run("N7eb plombier.", {})
    assert first.state == "needs_info"
    assert first.intent.category == "plumbing"
    assert first.context_update["missing_fields"] == ["location"]

    context = first.context_update
    second = pipeline.run("Ariana.", context)
    assert second.state == "waiting_confirmation"
    assert second.intent.entities["location"] == "Ariana"
    assert "location" not in second.intent.missing_fields

    context = {**context, **second.context_update}
    third = pipeline.run("Fama fuite fel cuisine.", context)
    assert third.state == "waiting_confirmation"
    assert third.intent.intent == "service_request"
    assert third.intent.category == "plumbing"
    assert third.intent.entities["location"] == "Ariana"
    assert third.intent.entities["problem"] == "Fama fuite fel cuisine."
    assert third.proposed_task is not None
    assert third.proposed_task.metadata["entities"]["problem"] == "Fama fuite fel cuisine."


def test_context_reset_prevents_previous_service_from_contaminating_new_intent():
    pipeline = NovaAIPipeline()
    first = pipeline.run("N7eb clim repair.", {})
    second = pipeline.run("Ariana.", first.context_update)
    context = {**first.context_update, **second.context_update}

    reset = pipeline.run("Actually, I want to buy a washing machine.", context)
    assert reset.state == "waiting_confirmation"
    assert reset.intent.intent == "product_search"
    assert reset.intent.category == "appliance"
    assert reset.intent.entities["product_type"] == "washing_machine"
    assert reset.intent.entities.get("location") is None


def test_known_entities_are_not_overwritten_by_follow_up_details():
    pipeline = NovaAIPipeline()
    first = pipeline.run("N7eb plombier fi Ariana.", {})
    context = first.context_update
    follow_up = pipeline.run("ghodwa matin", context)
    assert follow_up.state == "waiting_confirmation"
    assert follow_up.intent.entities["location"] == "Ariana"
    assert follow_up.intent.entities["date_expression"] == "tomorrow"
    assert follow_up.intent.entities["time_period"] == "morning"


def test_clarification_question_is_not_repeated_after_answer():
    pipeline = NovaAIPipeline()
    first = pipeline.run("I need someone to repair my AC tomorrow.", {})
    assert first.state == "needs_info"
    second = pipeline.run("Ariana", first.context_update)
    assert second.state == "waiting_confirmation"
    assert "which city" not in second.response.lower()


def test_follow_up_reference_keeps_current_service_context():
    pipeline = NovaAIPipeline()
    first = pipeline.run("N7eb plombier fi Ariana.", {})
    second = pipeline.run("Wala fama wa7ed akther proche?", first.context_update)
    assert second.state == "waiting_confirmation"
    assert second.intent.intent == "service_request"
    assert second.intent.category == "plumbing"
    assert second.intent.entities["location"] == "Ariana"
    assert second.intent.entities["follow_up"] == "Wala fama wa7ed akther proche?"
