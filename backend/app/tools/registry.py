from dataclasses import dataclass
from enum import StrEnum


class RiskLevel(StrEnum):
    READ_ONLY = "READ_ONLY"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    risk_level: RiskLevel
    schema: dict


class ToolRegistry:
    def __init__(self) -> None:
        self._tools = {
            "ServiceSearchTool": ToolDefinition(
                name="ServiceSearchTool",
                description="Search seeded demo service providers. Does not book anything.",
                risk_level=RiskLevel.READ_ONLY,
                schema={"category": "string", "location": "string"},
            ),
            "TaskTool": ToolDefinition(
                name="TaskTool",
                description="Create or update an internal NOVA task.",
                risk_level=RiskLevel.LOW,
                schema={"title": "string", "intent": "string"},
            ),
            "NotificationTool": ToolDefinition(
                name="NotificationTool",
                description="Create an internal reminder notification.",
                risk_level=RiskLevel.LOW,
                schema={"title": "string", "body": "string"},
            ),
        }

    def get(self, name: str) -> ToolDefinition:
        return self._tools[name]

    def list(self) -> list[ToolDefinition]:
        return list(self._tools.values())


tool_registry = ToolRegistry()
