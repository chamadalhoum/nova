"""Deterministic A/B evaluation for memory-aware NOVA conversations."""

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.ai.pipeline import NovaAIPipeline
from app.ai.provider import AIProviderError
from app.ai.schemas import AIFlowResult


@dataclass(frozen=True)
class MemoryConversationCase:
    id: str
    language: str
    messages: tuple[str, ...]
    context: dict[str, Any]
    memory_context: dict[str, Any]
    expected: dict[str, Any]
    fallback: bool = False


@dataclass(frozen=True)
class Rate:
    """A deterministic metric expressed as numerator/denominator and optional rate."""

    numerator: int
    denominator: int

    @property
    def value(self) -> float | None:
        return self.numerator / self.denominator if self.denominator else None


@dataclass(frozen=True)
class MemoryConversationMetrics:
    intent_accuracy: Rate
    category_accuracy: Rate
    entity_extraction_accuracy: Rate
    missing_information_detection: Rate
    clarification_relevance: Rate
    unnecessary_clarification_rate: Rate
    repeated_clarification_rate: Rate
    memory_relevance: Rate
    memory_misuse_rate: Rate
    unsupported_assumption_rate: Rate
    intent_change_correctness: Rate
    fallback_consistency: Rate


@dataclass(frozen=True)
class MemoryConversationEvaluationReport:
    without_memory: MemoryConversationMetrics
    with_memory: MemoryConversationMetrics


def load_memory_conversation_cases(path: Path) -> list[MemoryConversationCase]:
    """Load deterministic fixture cases without retaining conversation content elsewhere."""
    raw_cases = json.loads(path.read_text(encoding="utf-8"))
    return [
        MemoryConversationCase(
            id=item["id"],
            language=item["language"],
            messages=tuple(item["messages"]),
            context=item.get("context", {}),
            memory_context=item.get("memory_context", {}),
            expected=item["expected"],
            fallback=item.get("fallback", False),
        )
        for item in raw_cases
    ]


def evaluate_memory_conversation_cases(
    cases: list[MemoryConversationCase],
) -> MemoryConversationEvaluationReport:
    """Compare deterministic pipeline outcomes with identical contexts, memory off and on."""
    without_memory = [_run_case(case, memory_enabled=False) for case in cases]
    with_memory = [_run_case(case, memory_enabled=True) for case in cases]
    return MemoryConversationEvaluationReport(
        without_memory=_metrics(cases, without_memory, memory_enabled=False),
        with_memory=_metrics(cases, with_memory, memory_enabled=True),
    )


def _run_case(case: MemoryConversationCase, *, memory_enabled: bool) -> AIFlowResult:
    pipeline = NovaAIPipeline(provider=_UnavailableProvider()) if case.fallback else NovaAIPipeline()
    context = dict(case.context)
    if memory_enabled and case.memory_context:
        context["memory_context"] = case.memory_context
    result: AIFlowResult | None = None
    for message in case.messages:
        result = asyncio.run(pipeline.run_async(message, context)) if case.fallback else pipeline.run(message, context)
        context.update(result.context_update)
        if memory_enabled and case.memory_context:
            context["memory_context"] = case.memory_context
        else:
            context.pop("memory_context", None)
    assert result is not None
    return result


def _metrics(
    cases: list[MemoryConversationCase], results: list[AIFlowResult], *, memory_enabled: bool
) -> MemoryConversationMetrics:
    total = len(cases)
    intent_correct = 0
    category_correct = 0
    entities_correct = 0
    missing_correct = 0
    clarification_correct = 0
    unnecessary = 0
    repeated = 0
    memory_misuse = 0
    unsupported_assumptions = 0
    intent_change_incorrect = 0
    clarification_required = 0
    ready_required = 0
    multi_turn = 0
    location_memory_cases = 0
    fallback_cases = 0
    fallback_consistent = 0

    for case, result in zip(cases, results, strict=True):
        expected = case.expected
        expected_entities = expected.get("entities", {})
        expected_missing = sorted(expected.get("missing_fields", []))
        is_clarification = expected["state"] == "needs_info"
        if is_clarification:
            clarification_required += 1
        else:
            ready_required += 1
        if len(case.messages) > 1:
            multi_turn += 1
        if "location_suggestion" in case.memory_context:
            location_memory_cases += 1
        if case.fallback:
            fallback_cases += 1
            fallback_consistent += result.metadata.fallback_used

        intent_correct += result.intent.intent == expected["intent"]
        category_correct += result.intent.category == expected["category"]
        entities_correct += result.intent.entities == expected_entities
        missing_correct += sorted(result.intent.missing_fields) == expected_missing
        clarification_correct += is_clarification and result.state == "needs_info" and sorted(
            result.intent.missing_fields
        ) == expected_missing
        unnecessary += not is_clarification and result.state == "needs_info"
        repeated += len(case.messages) > 1 and not expected_missing and result.state == "needs_info"
        suggestion = case.memory_context.get("location_suggestion")
        memory_misuse += bool(suggestion and result.intent.entities.get("location") == suggestion and not expected_entities.get("location"))
        unsupported_assumptions += any(
            result.intent.entities.get(key) != value for key, value in expected_entities.items()
        ) or any(key not in expected_entities for key in result.intent.entities)
        intent_change_incorrect += len(case.messages) > 1 and (
            result.intent.intent != expected["intent"] or result.intent.category != expected["category"]
        )

    return MemoryConversationMetrics(
        intent_accuracy=Rate(intent_correct, total),
        category_accuracy=Rate(category_correct, total),
        entity_extraction_accuracy=Rate(entities_correct, total),
        missing_information_detection=Rate(missing_correct, total),
        clarification_relevance=Rate(clarification_correct, clarification_required),
        unnecessary_clarification_rate=Rate(unnecessary, ready_required),
        repeated_clarification_rate=Rate(repeated, multi_turn),
        # Relevance is established by UserMemoryContextService selection tests. This deterministic
        # conversation runner deliberately does not make memory suggestions into confirmed facts.
        memory_relevance=Rate(0, 0),
        memory_misuse_rate=Rate(memory_misuse, location_memory_cases),
        unsupported_assumption_rate=Rate(unsupported_assumptions, total),
        intent_change_correctness=Rate(multi_turn - intent_change_incorrect, multi_turn),
        fallback_consistency=Rate(fallback_consistent, fallback_cases),
    )


class _UnavailableProvider:
    async def classify(self, text: str, context: dict) -> tuple[object, object]:
        raise AIProviderError("provider unavailable")
