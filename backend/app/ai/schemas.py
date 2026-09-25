from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

IntentName = Literal[
    "service_request",
    "product_search",
    "appointment",
    "planning",
    "task_management",
    "document_help",
    "unknown",
]

SERVICE_CATEGORIES = {
    "air_conditioning",
    "plumbing",
    "electricity",
    "cleaning",
    "appliance_repair",
    "car_repair",
    "painting",
    "moving",
    "beauty",
    "home_maintenance",
}

KNOWN_CATEGORIES = SERVICE_CATEGORIES | {"appliance", "general", "appointment", "document"}

INTENT_ALIASES = {
    "event_planning": "planning",
    "travel_planning": "planning",
    "booking": "appointment",
}


class IntentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: IntentName
    category: str | None = None
    language: str
    entities: dict[str, str | int | float | bool] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    next_action: str | None = None
    suggested_capability: str | None = None

    @field_validator("intent")
    @classmethod
    def known_intent(cls, value: str) -> str:
        normalized = INTENT_ALIASES.get(value, value)
        allowed = IntentName.__args__  # type: ignore[attr-defined]
        if normalized not in allowed:
            raise ValueError("Unsupported intent")
        return normalized

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
        category_aliases = {
            "ac": "air_conditioning",
            "clim": "air_conditioning",
            "air_conditioner": "air_conditioning",
            "electrician": "electricity",
            "appliances": "appliance",
            "washing_machine": "appliance",
            "auto_repair": "car_repair",
            "vehicle_repair": "car_repair",
            "maintenance": "home_maintenance",
        }
        normalized = category_aliases.get(normalized, normalized)
        if normalized not in KNOWN_CATEGORIES:
            return "general"
        return normalized

    @model_validator(mode="after")
    def ensure_missing_fields_unique(self) -> "IntentResult":
        self.missing_fields = sorted(set(self.missing_fields))
        self.constraints = sorted(set(self.constraints))
        return self


class AIExecutionMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str = "deterministic"
    model: str | None = None
    latency_ms: int | None = None
    success: bool = True
    fallback_used: bool = False
    error_type: str | None = None
    token_usage: dict[str, int | None] | None = None


class TaskPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    category: str
    intent: str
    priority: str = "normal"
    due_date: str | None = None
    location: str | None = None
    constraints: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    next_action: str = "create_task"
    suggested_capability: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


class AIFlowResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: str
    response: str
    intent: IntentResult
    proposed_task: TaskPlan | None = None
    context_update: dict = Field(default_factory=dict)
    metadata: AIExecutionMetadata = Field(default_factory=AIExecutionMetadata)
