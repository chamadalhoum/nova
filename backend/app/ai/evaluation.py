"""Deterministic, reference-dataset evaluation for NOVA intent classification."""

from dataclasses import dataclass

from app.ai.pipeline import NovaAIPipeline


@dataclass(frozen=True)
class EvaluationCase:
    language: str
    text: str
    expected_intent: str
    expected_category: str | None


@dataclass(frozen=True)
class EvaluationMetrics:
    total: int
    intent_accuracy: float | None
    category_accuracy: float | None


@dataclass(frozen=True)
class EvaluationReport(EvaluationMetrics):
    by_language: dict[str, EvaluationMetrics]


def _metrics(results: list[tuple[bool, bool]]) -> EvaluationMetrics:
    total = len(results)
    if not total:
        return EvaluationMetrics(total=0, intent_accuracy=None, category_accuracy=None)
    return EvaluationMetrics(
        total=total,
        intent_accuracy=sum(intent_match for intent_match, _ in results) / total,
        category_accuracy=sum(category_match for _, category_match in results) / total,
    )


def evaluate_intent_cases(cases: list[EvaluationCase]) -> EvaluationReport:
    """Evaluate deterministic intent/category accuracy without retaining user inputs."""

    pipeline = NovaAIPipeline()
    matches: list[tuple[bool, bool]] = []
    by_language: dict[str, list[tuple[bool, bool]]] = {}
    for case in cases:
        result = pipeline.run(case.text, {})
        match = (
            result.intent.intent == case.expected_intent,
            result.intent.category == case.expected_category,
        )
        matches.append(match)
        by_language.setdefault(case.language, []).append(match)
    overall = _metrics(matches)
    return EvaluationReport(
        total=overall.total,
        intent_accuracy=overall.intent_accuracy,
        category_accuracy=overall.category_accuracy,
        by_language={language: _metrics(items) for language, items in sorted(by_language.items())},
    )
