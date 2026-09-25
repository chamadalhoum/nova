from dataclasses import dataclass, field
from typing import Literal

RiskLevel = Literal["READ_ONLY", "LOW", "MEDIUM", "HIGH"]


@dataclass(frozen=True)
class CapabilityDefinition:
    name: str
    description: str
    risk_level: RiskLevel
    required_permissions: list[str] = field(default_factory=list)
    required_inputs: list[str] = field(default_factory=list)
    confirmation_required: bool = False
    enabled: bool = True

    def public_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "risk_level": self.risk_level,
            "required_permissions": self.required_permissions,
            "required_inputs": self.required_inputs,
            "confirmation_required": self.confirmation_required,
            "enabled": self.enabled,
        }


class CapabilityRegistry:
    def __init__(self, capabilities: list[CapabilityDefinition]) -> None:
        self._capabilities = {capability.name: capability for capability in capabilities}

    def list_public(self) -> list[dict]:
        return [capability.public_dict() for capability in self._capabilities.values()]

    def get(self, name: str) -> CapabilityDefinition | None:
        return self._capabilities.get(name)

    def require_enabled(self, name: str) -> CapabilityDefinition:
        capability = self.get(name)
        if capability is None:
            raise CapabilityError("I do not know how to do that yet.", "capability_unknown")
        if not capability.enabled:
            raise CapabilityError(
                "I can prepare this request, but this action is not available yet.",
                "capability_disabled",
            )
        return capability

    def validate_inputs(self, name: str, inputs: dict) -> CapabilityDefinition:
        capability = self.require_enabled(name)
        missing = []
        for input_name in capability.required_inputs:
            value = inputs.get(input_name)
            if value is None or (isinstance(value, str) and not value.strip()) or value == "":
                missing.append(input_name)
        if missing:
            raise CapabilityError(
                "I need one more detail before I can do that.",
                "capability_missing_inputs",
                {"missing_fields": missing},
            )
        return capability


class CapabilityError(Exception):
    def __init__(self, message: str, code: str, data: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.data = data or {}


capability_registry = CapabilityRegistry(
    [
        CapabilityDefinition(
            name="create_task",
            description="Create a trackable NOVA task after user confirmation.",
            risk_level="LOW",
            required_inputs=["title"],
            confirmation_required=True,
        ),
        CapabilityDefinition(
            name="search_services",
            description="Search demo service options from NOVA's provider directory.",
            risk_level="READ_ONLY",
            required_inputs=["category", "location"],
            confirmation_required=False,
        ),
        CapabilityDefinition(
            name="prepare_service_request",
            description="Prepare an internal service request without contacting an external provider.",
            risk_level="LOW",
            required_inputs=["category", "location"],
            confirmation_required=False,
        ),
        CapabilityDefinition(
            name="confirm_service_request",
            description="Confirm an internal NOVA service request without contacting an external provider.",
            risk_level="LOW",
            required_inputs=["service_request_id"],
            confirmation_required=True,
        ),
        CapabilityDefinition(
            name="compare_providers",
            description="Compare available demo provider results without inventing ratings, prices, or availability.",
            risk_level="READ_ONLY",
            required_inputs=["providers"],
            confirmation_required=False,
        ),
        CapabilityDefinition(
            name="set_reminder",
            description="Create a reminder linked to a NOVA task.",
            risk_level="LOW",
            required_inputs=["task_id", "remind_at"],
            confirmation_required=False,
        ),
        CapabilityDefinition(
            name="manage_memory",
            description="Save or delete explicit user-controlled preferences.",
            risk_level="LOW",
            required_inputs=["key", "value"],
            confirmation_required=True,
        ),
        CapabilityDefinition(
            name="manage_asset",
            description="Create and view user-owned passport assets.",
            risk_level="LOW",
            required_inputs=["name"],
            confirmation_required=False,
        ),
        CapabilityDefinition(
            name="send_external_request",
            description="Contact an external provider. Not connected in the MVP.",
            risk_level="MEDIUM",
            required_inputs=["provider_id", "task_id"],
            confirmation_required=True,
            enabled=False,
        ),
        CapabilityDefinition(
            name="booking",
            description="Book a real-world service appointment. Not connected yet.",
            risk_level="HIGH",
            required_inputs=["provider_id", "task_id"],
            confirmation_required=True,
            enabled=False,
        ),
        CapabilityDefinition(
            name="payment",
            description="Take or send payment. Not connected yet.",
            risk_level="HIGH",
            required_inputs=["amount", "currency"],
            confirmation_required=True,
            enabled=False,
        ),
    ]
)
