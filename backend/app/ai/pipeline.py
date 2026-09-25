import re
from datetime import UTC, date, datetime, timedelta

from app.ai.provider import AIProviderError, DeterministicProvider, get_provider_for_mode
from app.ai.schemas import AIExecutionMetadata, AIFlowResult, IntentResult, TaskPlan
from app.core.config import settings

LOCATION_HINTS = {
    "ariana",
    "tunis",
    "sousse",
    "sfax",
    "ben arous",
    "manouba",
    "nabeul",
    "paris",
    "london",
    "la marsa",
    "hammamet",
    "marsa",
    "أريانة",
}

SERVICE_REQUIRED_FIELDS = {"service_request": ["location"], "appointment": ["appointment_subject"]}
NEXT_ACTION_BY_INTENT = {
    "service_request": "search_services",
    "product_search": "create_task",
    "appointment": "create_task",
    "planning": "create_task",
    "task_management": "create_task",
    "document_help": "create_task",
}
SERVICE_KEYWORDS = {
    "air_conditioning": ["clim", "ac", "air conditioning", "الكليم", "كليم", "climatiseur", "climatisation"],
    "plumbing": ["leak", "fuite", "water", "plomberie", "plumbing", "plombier", "plumber", "ماء", "سباك"],
    "electricity": ["electric", "électricité", "electricien", "électricien", "dhaw", "ضو"],
    "appliance_repair": ["machine", "fridge", "refrigerator", "réfrigérateur", "غسالة"],
    "car_repair": ["car", "vehicle", "voiture", "auto", "mécanicien", "mechanic"],
    "painting": ["paint", "painting", "peinture", "صباغة"],
    "moving": ["moving", "move", "déménagement", "demenagement", "na9la", "نقلة", "نقل"],
    "beauty": ["beauty", "salon", "hair", "coiffure", "coiffeur"],
    "home_maintenance": ["home maintenance", "maintenance maison", "handyman", "bricolage"],
    "cleaning": ["clean", "cleaning", "ménage", "nettoyage", "nadhafa"],
}
RESET_TERMS = ["actually", "instead", "change", "switch", "au final", "plutôt", "plutot", "بدل", "badel"]
FOLLOW_UP_TERMS = ["wa7ed", "one", "option", "proche", "closer", "nearer", "akther", "plus proche"]


class IntentClassifier:
    def classify(self, text: str, context: dict | None = None) -> IntentResult:
        normalized = text.lower().strip()
        language = self._detect_language(text)
        entities: dict[str, str] = {}
        problem = self._extract_problem(text, normalized)
        if problem:
            entities["problem"] = problem
        date_expression = self._extract_date_expression(normalized)
        if date_expression:
            entities["date_expression"] = date_expression
        if any(word in normalized for word in ["afternoon", "après-midi", "apres-midi"]):
            entities["time_period"] = "afternoon"
        if any(word in normalized for word in ["morning", "matin", "sbeh", "صباح"]):
            entities["time_period"] = "morning"
        if any(word in normalized for word in ["low budget", "pas cher", "ma tetkalefch", "barcha"]):
            entities["budget"] = "low"
        location = self._extract_location(normalized)
        if location:
            entities["location"] = location

        wants_to_buy = any(term in normalized for term in ["nechri", "buy", "acheter", "purchase"])
        mentions_washing_machine = any(term in normalized for term in ["machine à laver", "washing machine", "غسالة"])
        wants_to_repair = any(term in normalized for term in ["repair", "fix", "réparer", "répare", "ysala7", "يصلح", "صلح"])
        if mentions_washing_machine and wants_to_repair:
            missing = [] if "location" in entities else ["location"]
            return IntentResult(
                intent="service_request",
                category="appliance_repair",
                language=language,
                entities=entities,
                constraints=self._extract_constraints(normalized),
                missing_fields=missing,
                confidence=0.82,
                next_action="search_services" if not missing else None,
                suggested_capability="search_services" if not missing else None,
            )

        if wants_to_buy or mentions_washing_machine:
            return IntentResult(
                intent="product_search",
                category="appliance",
                language=language,
                entities={**entities, "product_type": "washing_machine"},
                constraints=self._extract_constraints(normalized),
                missing_fields=[],
                confidence=0.76,
                next_action="create_task",
                suggested_capability="create_task",
            )

        service_category = self._extract_service_category(normalized)
        if service_category:
            missing = [] if "location" in entities else ["location"]
            return IntentResult(
                intent="service_request",
                category=service_category,
                language=language,
                entities=entities,
                constraints=self._extract_constraints(normalized),
                missing_fields=missing,
                confidence=0.86,
                next_action="search_services" if not missing else None,
                suggested_capability="search_services" if not missing else None,
            )

        if any(term in normalized for term in ["rendez-vous", "appointment", "موعد", "n7جز", "نحجز", "book"]):
            return IntentResult(
                intent="appointment",
                category="appointment",
                language=language,
                entities=entities,
                missing_fields=["appointment_subject"],
                confidence=0.7,
                next_action=None,
            )

        return IntentResult(
            intent="unknown",
            category=None,
            language=language,
            entities=entities,
            constraints=[],
            missing_fields=["request_details"],
            confidence=0.35,
        )

    def _detect_language(self, text: str) -> str:
        lowered = text.lower()
        has_arabic = bool(re.search(r"[\u0600-\u06FF]", text))
        has_latin = bool(re.search(r"[A-Za-z]", text))
        has_arabizi = any(token in lowered for token in ["n7eb", "ysala7", "ghodwa", "findli", "wa7ed", "fama"])
        has_french = any(token in lowered for token in ["répare", "réparer", "demain", "fuite", "je veux", "cherche"])
        if has_arabic and has_latin:
            return "mixed"
        if has_arabizi and has_french:
            return "mixed"
        if has_arabizi or "n7جز" in text:
            return "arabizi"
        if has_arabic:
            return "tn"
        if has_french:
            return "fr"
        return "en"

    def _extract_date_expression(self, normalized: str) -> str | None:
        expressions = {
            "tomorrow": "tomorrow",
            "demain": "tomorrow",
            "ghodwa": "tomorrow",
            "غدوة": "tomorrow",
            "today": "today",
            "aujourd'hui": "today",
            "ce soir": "tonight",
            "next week": "next_week",
            "el jem3a jeya": "next_week",
        }
        for raw, normalized_expression in expressions.items():
            if raw in normalized:
                return normalized_expression
        return None

    def _extract_constraints(self, normalized: str) -> list[str]:
        if any(
            term in normalized
            for term in ["ma n7ebbech nخلص barcha", "ma tetkalefch", "pas cher", "low budget", "budget"]
        ):
            return ["low_budget_preference"]
        return []

    def _extract_service_category(self, normalized: str) -> str | None:
        action_terms = [
            "repair",
            "fix",
            "répare",
            "réparateur",
            "reparer",
            "réparer",
            "ysala7",
            "يصلح",
            "صلح",
            "cherche",
            "veux",
            "besoin",
            "need",
            "n7eb",
            "نحب",
            "help",
            "find",
            "search",
            "show",
            "montre",
            "prepare",
            "compare",
            "send",
            "nلقى",
            "technicien",
            "organize",
            "organiser",
            "نظم",
            "ننظم",
        ]
        has_action = any(term in normalized for term in action_terms)
        for category, terms in SERVICE_KEYWORDS.items():
            has_category = any(self._has_term(normalized, term) for term in terms)
            if has_category and (has_action or category in {"plumbing"}):
                return category
        return None

    def _has_term(self, normalized: str, term: str) -> bool:
        if term in {"ac", "ménage"}:
            return bool(re.search(rf"(?<![\wÀ-ÿ]){re.escape(term)}(?![\wÀ-ÿ])", normalized))
        return term in normalized

    def _extract_location(self, normalized: str) -> str | None:
        for location in sorted(LOCATION_HINTS, key=len, reverse=True):
            if location in normalized:
                if location == "أريانة":
                    return "Ariana"
                return location.title()
        return None

    def _extract_problem(self, text: str, normalized: str) -> str | None:
        problem_terms = ["fuite", "leak", "cuisine", "kitchen", "الكوجينة", "ma tetla3ch", "bared", "بارد"]
        if any(term in normalized for term in problem_terms):
            return text.strip()
        return None


class ContextManager:
    def build(self, context: dict | None) -> dict:
        existing = context or {}
        return {
            "locale": existing.get("locale", "en"),
            "timezone": existing.get("timezone", "UTC"),
            "pending_intent": existing.get("pending_intent"),
            "pending_task": existing.get("pending_task"),
            "last_intent": existing.get("last_intent"),
            "last_task_id": existing.get("last_task_id"),
            "current_intent": existing.get("current_intent"),
            "current_category": existing.get("current_category"),
            "known_entities": existing.get("known_entities", {}),
            "missing_fields": existing.get("missing_fields", []),
            "last_question": existing.get("last_question"),
            "conversation_language": existing.get("conversation_language", existing.get("locale", "en")),
        }


class ConfidenceManager:
    def needs_clarification(self, intent: IntentResult) -> bool:
        if intent.confidence < 0.5:
            return True
        return bool(intent.missing_fields)


class QuestionManager:
    def question_for(self, intent: IntentResult) -> str:
        if "location" in intent.missing_fields:
            if intent.language in {"arabizi", "ar", "mixed"}:
                return "Nfhem elli t7eb service. Fi anéhi ville/zone, which city or area, nlawwej?"
            return "I understand what service you need. Which city or area should I search in?"
        if "appointment_subject" in intent.missing_fields:
            return "What kind of appointment do you want NOVA to help you prepare?"
        return "I could not understand enough yet. Could you describe what you need NOVA to help with?"


class TaskPlanner:
    def plan(self, intent: IntentResult) -> TaskPlan:
        category_name = (intent.category or "general").replace("_", " ")
        if intent.category == "air_conditioning":
            title = "Repair air conditioner"
            description = "Find help for air conditioning repair."
        elif intent.category == "plumbing":
            title = "Fix plumbing issue"
            description = "Find help for a plumbing issue."
        elif intent.intent == "product_search":
            title = "Find product options"
            description = "Prepare a product search task without inventing prices or products."
        elif intent.intent == "appointment":
            title = "Prepare appointment"
            description = "Clarify and plan an appointment request."
        else:
            title = "New NOVA task"
            description = "NOVA prepared a task from your request."
        return TaskPlan(
            title=title,
            description=description,
            category=intent.category or "general",
            intent=intent.intent,
            due_date=DateNormalizer().normalize(intent.entities.get("date_expression")),
            location=str(intent.entities.get("location")) if intent.entities.get("location") else None,
            constraints=intent.constraints,
            missing_fields=intent.missing_fields,
            next_action=intent.next_action or "create_task",
            suggested_capability=intent.suggested_capability or NEXT_ACTION_BY_INTENT.get(intent.intent),
            metadata={
                "entities": intent.entities,
                "category_label": category_name,
                "next_capability": intent.suggested_capability or NEXT_ACTION_BY_INTENT.get(intent.intent),
            },
        )


class ToolSelector:
    def select(self, intent: IntentResult) -> list[dict]:
        if intent.intent == "service_request":
            return [{"name": "ServiceSearchTool", "risk_level": "READ_ONLY"}, {"name": "TaskTool", "risk_level": "LOW"}]
        if intent.intent in {"product_search", "appointment", "planning", "task_management"}:
            return [{"name": "TaskTool", "risk_level": "LOW"}]
        return []


class SafetyGuard:
    def validate(self, tools: list[dict]) -> bool:
        return all(tool["risk_level"] in {"READ_ONLY", "LOW", "MEDIUM", "HIGH"} for tool in tools)

    def sanitize_intent(self, intent: IntentResult) -> IntentResult:
        required = SERVICE_REQUIRED_FIELDS.get(intent.intent, [])
        missing = set(intent.missing_fields)
        for field in required:
            if field not in intent.entities:
                missing.add(field)
        data = intent.model_dump()
        data["missing_fields"] = sorted(missing)
        if data.get("next_action") == "search_providers":
            data["next_action"] = "search_services"
        if not data.get("suggested_capability") and not data["missing_fields"]:
            data["suggested_capability"] = NEXT_ACTION_BY_INTENT.get(intent.intent)
        return IntentResult.model_validate(data)


class ActionExecutor:
    def execute(self, tools: list[dict]) -> dict:
        return {"selected_tools": tools, "external_action_executed": False}


class ResponseGenerator:
    def confirmation(self, plan: TaskPlan, intent: IntentResult) -> str:
        location = intent.entities.get("location")
        date = DateNormalizer().normalize(intent.entities.get("date_expression"))
        details = []
        if location:
            details.append(f"in {location}")
        if date:
            details.append(date)
        suffix = f" {' '.join(details)}" if details else ""
        if intent.language == "fr":
            capability_note = " Je peux chercher des options de service démo après création. La réservation réelle n'est pas connectée." if plan.suggested_capability == "search_services" else ""
            return f"Bien sûr. J'ai compris la demande{suffix}. Confirmez pour créer cette tâche.{capability_note}"
        if intent.language in {"ar", "tn", "arabizi", "mixed"}:
            capability_note = " Najem nlawwej options demo baad ma nخلق المهمة. Real booking موش مربوط توة." if plan.suggested_capability == "search_services" else ""
            return f"أكيد، فهمت الطلب{suffix}. Confirmi باش نخلق المهمة.{capability_note}"
        capability_note = " I can search demo service options after this task is created. Real booking is not connected yet." if plan.suggested_capability == "search_services" else ""
        return f"Sure. I have enough information to prepare this task{suffix}. Please confirm to create it.{capability_note}"


class DateNormalizer:
    def __init__(self, today: date | None = None) -> None:
        self.today = today or datetime.now(UTC).date()

    def normalize(self, expression: object) -> str | None:
        if not isinstance(expression, str):
            return None
        normalized = expression.strip().lower()
        if normalized in {"tomorrow", "demain", "ghodwa", "غدوة"}:
            return (self.today + timedelta(days=1)).isoformat()
        if normalized in {"today", "aujourd'hui"}:
            return self.today.isoformat()
        if normalized in {"next_week", "next week", "el jem3a jeya"}:
            return (self.today + timedelta(days=7)).isoformat()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", normalized):
            return normalized
        return None


class NovaAIPipeline:
    def __init__(self, provider=None, fallback_provider=None) -> None:
        self.intent_classifier = IntentClassifier()
        self.context_manager = ContextManager()
        self.confidence_manager = ConfidenceManager()
        self.question_manager = QuestionManager()
        self.task_planner = TaskPlanner()
        self.tool_selector = ToolSelector()
        self.safety_guard = SafetyGuard()
        self.action_executor = ActionExecutor()
        self.response_generator = ResponseGenerator()
        self.provider = provider
        self.fallback_provider = fallback_provider or DeterministicProvider()

    def run(self, text: str, context: dict | None = None) -> AIFlowResult:
        return self._run_with_intent(text, context, self.intent_classifier.classify(text, context or {}), AIExecutionMetadata())

    async def run_async(self, text: str, context: dict | None = None) -> AIFlowResult:
        existing = self.context_manager.build(context)
        if existing.get("pending_intent"):
            return self.run(text, existing)

        provider = self.provider
        mode = settings.ai_mode.lower()
        metadata = AIExecutionMetadata()
        try:
            if provider is None:
                provider = get_provider_for_mode()
            intent, metadata = await provider.classify(text, existing)
        except AIProviderError as exc:
            if mode == "real":
                intent, metadata = await self.fallback_provider.classify(text, existing)
                metadata = metadata.model_copy(
                    update={"fallback_used": True, "success": False, "error_type": exc.__class__.__name__}
                )
            else:
                intent, metadata = await self.fallback_provider.classify(text, existing)
                metadata = metadata.model_copy(
                    update={"fallback_used": True, "success": False, "error_type": exc.__class__.__name__}
                )
        return self._run_with_intent(text, existing, intent, metadata)

    def _run_with_intent(
        self,
        text: str,
        context: dict | None,
        intent: IntentResult,
        metadata: AIExecutionMetadata,
    ) -> AIFlowResult:
        existing = self.context_manager.build(context)
        pending = existing.get("pending_intent")
        pending_task = existing.get("pending_task")
        if pending and pending.get("missing_fields") and not self._is_intent_reset(text, intent, pending):
            intent = self._merge_clarification_answer(text, existing, pending, intent)
        elif pending_task and not self._is_intent_reset(text, intent, pending_task):
            return self._merge_pending_task(text, existing, pending_task, intent, metadata)
        else:
            intent = self._merge_known_context(existing, self.safety_guard.sanitize_intent(intent))

        if self.confidence_manager.needs_clarification(intent):
            return AIFlowResult(
                state="needs_info",
                response=self.question_manager.question_for(intent),
                intent=intent,
                context_update={
                    "pending_intent": intent.model_dump(),
                    "last_intent": intent.model_dump(),
                    "current_intent": intent.intent,
                    "current_category": intent.category,
                    "known_entities": intent.entities,
                    "missing_fields": intent.missing_fields,
                    "conversation_language": intent.language,
                    "last_user_message": text[:500],
                },
                metadata=metadata,
            )

        plan = self.task_planner.plan(intent)
        tools = self.tool_selector.select(intent)
        self.safety_guard.validate(tools)
        self.action_executor.execute(tools)
        return AIFlowResult(
            state="waiting_confirmation",
            response=self.response_generator.confirmation(plan, intent),
            intent=intent,
            proposed_task=plan,
            context_update={
                "pending_task": plan.model_dump(),
                "pending_intent": None,
                "last_intent": intent.model_dump(),
                "current_intent": intent.intent,
                "current_category": intent.category,
                "known_entities": intent.entities,
                "missing_fields": [],
                "conversation_language": intent.language,
                "last_user_message": text[:500],
            },
            metadata=metadata,
        )

    def _is_intent_reset(self, text: str, incoming: IntentResult, previous: dict) -> bool:
        normalized = text.lower()
        if any(term in normalized for term in RESET_TERMS):
            return True
        previous_intent = previous.get("intent") or previous.get("current_intent")
        previous_category = previous.get("category") or previous.get("current_category")
        if incoming.intent == "unknown" or incoming.confidence < 0.7:
            return False
        if previous_intent and incoming.intent != previous_intent:
            return True
        return bool(previous_category and incoming.category and incoming.category != previous_category)

    def _merge_clarification_answer(
        self, text: str, existing: dict, pending: dict, incoming: IntentResult
    ) -> IntentResult:
        entities = dict(existing.get("known_entities") or {})
        entities.update(pending.get("entities") or {})
        for key, value in incoming.entities.items():
            if value not in {None, ""}:
                entities[key] = value
        missing_fields = list(pending.get("missing_fields", []))
        if missing_fields:
            field = missing_fields.pop(0)
            if field == "location":
                entities[field] = incoming.entities.get("location") or text.strip()
            elif field == "service_type":
                category = incoming.category or self.intent_classifier._extract_service_category(text.lower())
                if category:
                    return IntentResult(
                        intent="service_request",
                        category=category,
                        language=incoming.language or pending.get("language", "en"),
                        entities=entities,
                        constraints=pending.get("constraints", []),
                        missing_fields=[] if entities.get("location") else ["location"],
                        confidence=0.82,
                        next_action="search_services" if entities.get("location") else None,
                        suggested_capability="search_services" if entities.get("location") else None,
                    )
                entities[field] = text.strip()
            else:
                entities[field] = text.strip()
        return IntentResult(
            intent=pending["intent"],
            category=pending.get("category") or incoming.category,
            language=pending.get("language") or incoming.language,
            entities=entities,
            constraints=sorted(set(pending.get("constraints", []) + incoming.constraints)),
            missing_fields=missing_fields,
            confidence=max(float(pending.get("confidence", 0.7)), incoming.confidence, 0.8),
            next_action=pending.get("next_action") or incoming.next_action or "search_services",
            suggested_capability=pending.get("suggested_capability") or incoming.suggested_capability or "search_services",
        )

    def _merge_known_context(self, existing: dict, intent: IntentResult) -> IntentResult:
        known_entities = dict(existing.get("known_entities") or {})
        same_context = intent.intent != "unknown" and existing.get("current_intent") == intent.intent
        same_category = not existing.get("current_category") or existing.get("current_category") == intent.category
        if same_context and same_category:
            merged_entities = {**known_entities, **intent.entities}
            data = intent.model_dump()
            data["entities"] = merged_entities
            data["missing_fields"] = [field for field in intent.missing_fields if field not in merged_entities]
            return IntentResult.model_validate(data)
        return intent

    def _merge_pending_task(
        self,
        text: str,
        existing: dict,
        pending_task: dict,
        incoming: IntentResult,
        metadata: AIExecutionMetadata,
    ) -> AIFlowResult:
        task = dict(pending_task)
        task_metadata = dict(task.get("metadata") or {})
        entities = dict(existing.get("known_entities") or {})
        entities.update(task_metadata.get("entities") or {})
        entities.update({key: value for key, value in incoming.entities.items() if value not in {None, ""}})
        if incoming.intent == "unknown" and any(term in text.lower() for term in FOLLOW_UP_TERMS):
            entities["follow_up"] = text.strip()
        if incoming.intent == "unknown" and "problem" not in entities:
            problem = self.intent_classifier._extract_problem(text, text.lower())
            if problem:
                entities["problem"] = problem
        task_metadata["entities"] = entities
        task["metadata"] = task_metadata
        task["location"] = entities.get("location") or task.get("location")
        task["due_date"] = task.get("due_date") or DateNormalizer().normalize(entities.get("date_expression"))
        plan = TaskPlan.model_validate(task)
        intent = IntentResult(
            intent=existing.get("current_intent") or task.get("intent", "unknown"),
            category=existing.get("current_category") or task.get("category"),
            language=existing.get("conversation_language") or incoming.language,
            entities=entities,
            constraints=plan.constraints,
            missing_fields=[],
            confidence=max(incoming.confidence, 0.8),
            next_action=plan.next_action,
            suggested_capability=plan.suggested_capability,
        )
        return AIFlowResult(
            state="waiting_confirmation",
            response=self.response_generator.confirmation(plan, intent),
            intent=intent,
            proposed_task=plan,
            context_update={
                "pending_task": plan.model_dump(),
                "pending_intent": None,
                "last_intent": intent.model_dump(),
                "current_intent": intent.intent,
                "current_category": intent.category,
                "known_entities": entities,
                "missing_fields": [],
                "conversation_language": intent.language,
                "last_user_message": text[:500],
            },
            metadata=metadata,
        )
