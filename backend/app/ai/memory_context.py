"""Bounded, read-only user memory selection for AI request context."""

import logging
import re

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Memory, User

logger = logging.getLogger(__name__)


class UserMemoryContextService:
    """Select safe, request-relevant memory owned by the authenticated user."""

    MAX_MEMORY_ROWS = 20
    MAX_MEMORIES = 3
    MAX_VALUE_LENGTH = 80
    MAX_CONTEXT_CHARS = 180

    _LANGUAGE_KEYS = {"language", "preferred_language"}
    _LOCATION_KEYS = {"preferred_location", "home_city"}
    _PROXIMITY_KEYS = {"provider_proximity"}
    _LANGUAGES = {"en", "fr", "ar", "tn", "arabizi"}
    _PROXIMITY_VALUES = {"nearby", "close", "proche", "près", "قريب"}
    _SERVICE_TERMS = {
        "plumber", "plombier", "electrician", "électricien", "electricien", "mechanic",
        "mécanicien", "clim", "repair", "réparer", "service", "سباك", "كهربائي", "تصليح",
    }

    def build_context(
        self,
        db: Session,
        user: User | None,
        message: str,
        conversation_context: dict | None,
    ) -> dict[str, object]:
        """Return selected non-authoritative data, or an empty context on query failure."""
        if user is None or not user.id:
            return {}
        try:
            memories = db.scalars(
                select(Memory)
                .where(Memory.user_id == user.id)
                .order_by(Memory.updated_at.desc(), Memory.created_at.desc())
                .limit(self.MAX_MEMORY_ROWS)
            ).all()
        except SQLAlchemyError:
            logger.warning("User memory context query failed")
            return {}

        return self._select(memories, message, conversation_context or {})

    def _select(self, memories: list[Memory], message: str, conversation_context: dict) -> dict[str, object]:
        selected: dict[str, object] = {}
        locations: list[str] = []
        total_chars = 0
        service_request = self._is_service_request(message, conversation_context)
        has_current_location = self._has_current_location(message, conversation_context)

        for memory in memories:
            if len(selected) >= self.MAX_MEMORIES or total_chars >= self.MAX_CONTEXT_CHARS:
                break
            value = self._safe_value(memory.value)
            if value is None:
                continue

            if memory.type == "user_preference" and memory.key in self._LANGUAGE_KEYS:
                language = value.lower()
                if "language_preference" not in selected and language in self._LANGUAGES:
                    selected["language_preference"] = language
                    total_chars += len(language)
                continue

            if memory.type in {"user_preference", "location"} and memory.key in self._LOCATION_KEYS:
                if service_request and not has_current_location:
                    locations.append(value)
                continue

            if memory.type == "user_preference" and memory.key in self._PROXIMITY_KEYS:
                preference = value.lower()
                if service_request and preference in self._PROXIMITY_VALUES and "provider_preferences" not in selected:
                    selected["provider_preferences"] = [preference]
                    total_chars += len(preference)

        unique_locations = {location.casefold(): location for location in locations}
        if len(unique_locations) == 1 and len(selected) < self.MAX_MEMORIES:
            location = next(iter(unique_locations.values()))
            if total_chars + len(location) <= self.MAX_CONTEXT_CHARS:
                selected["location_suggestion"] = location
        return selected

    def _safe_value(self, value: str) -> str | None:
        normalized = value.strip()
        if not normalized or len(normalized) > self.MAX_VALUE_LENGTH:
            return None
        lowered = normalized.lower()
        suspicious_terms = ("ignore previous", "system prompt", "reveal secret", "developer message")
        if any(term in lowered for term in suspicious_terms):
            return None
        return normalized

    def _is_service_request(self, message: str, conversation_context: dict) -> bool:
        if conversation_context.get("current_intent") == "service_request":
            return True
        normalized = message.casefold()
        return any(term in normalized for term in self._SERVICE_TERMS)

    def _has_current_location(self, message: str, conversation_context: dict) -> bool:
        known_entities = conversation_context.get("known_entities") or {}
        if isinstance(known_entities, dict) and known_entities.get("location"):
            return True
        return bool(re.search(r"\b(?:in|à|fi)\s+[^\s.,!?]+|في\s+[^\s.,!?]+", message, flags=re.IGNORECASE))
