import json
from pathlib import Path

import pytest

from app.ai.pipeline import NovaAIPipeline

DATASET_PATH = Path(__file__).parent / "fixtures" / "ai_intent_eval.json"


def load_cases() -> list[dict]:
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", load_cases(), ids=lambda case: case["id"])
def test_ai_eval_dataset_regression(case: dict) -> None:
    result = NovaAIPipeline().run(case["text"], {})
    expected = case["expected"]
    assert result.intent.intent == expected["intent"]
    assert result.intent.category == expected["category"]
    assert sorted(result.intent.missing_fields) == sorted(expected.get("missing_fields", []))
    for key, value in expected.get("entities", {}).items():
        assert result.intent.entities.get(key) == value
    for constraint in expected.get("constraints", []):
        assert constraint in result.intent.constraints
