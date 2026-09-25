import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select, update
from sqlalchemy.orm import Session

from app.ai.pipeline import NovaAIPipeline
from app.auth.dependencies import get_current_user, require_admin_user
from app.capabilities.registry import CapabilityError, capability_registry
from app.common.http import iso
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import (
    Asset,
    AuditLog,
    Conversation,
    Memory,
    Message,
    Notification,
    Provider,
    ProviderService,
    RefreshToken,
    ServiceCategory,
    ServiceRequest,
    Task,
    TaskEvent,
    ToolExecution,
    User,
    UserPreference,
)
from app.schemas import (
    AdminDashboardOut,
    AdminPage,
    AIMessageResponse,
    AssetCreate,
    AssetOut,
    CapabilityOut,
    ConversationCreate,
    ConversationOut,
    MemoryCreate,
    MemoryOut,
    MessageCreate,
    MessageOut,
    NotificationOut,
    ProviderOut,
    ProviderSearchResult,
    ProviderSelectionCreate,
    RefreshRequest,
    ServiceCategoryOut,
    ServiceDiscoveryResponse,
    ServiceRequestCreate,
    ServiceRequestOut,
    TaskCreate,
    TaskEventOut,
    TaskOut,
    TaskUpdate,
    TokenPair,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from app.tasks.service import add_task_event, transition_task

router = APIRouter(prefix="/api/v1")
ai_pipeline = NovaAIPipeline()
auth_attempts: dict[str, list[datetime]] = {}
ai_attempts: dict[str, list[datetime]] = {}

PRODUCT_EVENTS = {
    "signup_completed",
    "conversation_started",
    "intent_detected",
    "clarification_requested",
    "task_created",
    "task_confirmed",
    "service_search_started",
    "service_results_viewed",
    "provider_selected",
    "service_request_prepared",
    "service_request_confirmed",
    "task_completed",
}


def track_product_event(db: Session, user_id: str | None, event_name: str, data: dict | None = None) -> None:
    if event_name not in PRODUCT_EVENTS:
        raise ValueError(f"Unknown product event: {event_name}")
    db.add(AuditLog(user_id=user_id, action=f"product.{event_name}", data=data or {}))


def check_auth_rate_limit(key: str) -> None:
    if not check_rate_limit(f"auth:{key}", 8, 60, auth_attempts):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait a moment and try again.",
        )


def client_bucket(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host


def check_ai_rate_limit(user_id: str) -> None:
    if not check_rate_limit(f"ai:{user_id}", 20, 60, ai_attempts):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="NOVA is receiving too many requests. Please wait a moment and try again.",
        )


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        locale=user.locale,
        timezone=user.timezone,
        role=user.role,
    )


def message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        role=message.role,
        message_type=message.message_type,
        content=message.content,
        data=message.data,
        created_at=iso(message.created_at),
    )


def event_out(event: TaskEvent) -> TaskEventOut:
    return TaskEventOut(
        id=event.id,
        event_type=event.event_type,
        message=event.message,
        data=event.data,
        created_at=iso(event.created_at),
    )


def memory_out(memory: Memory) -> MemoryOut:
    return MemoryOut(
        id=memory.id,
        type=memory.type,
        key=memory.key,
        value=memory.value,
        source=memory.source,
        created_at=iso(memory.created_at),
        updated_at=iso(memory.updated_at),
    )


def notification_out(item: Notification) -> NotificationOut:
    return NotificationOut(
        id=item.id,
        title=item.title,
        body=item.body,
        status=item.status,
        remind_at=item.remind_at,
        created_at=iso(item.created_at),
    )


def service_request_out(request: ServiceRequest) -> ServiceRequestOut:
    return ServiceRequestOut(
        id=request.id,
        task_id=request.task_id,
        provider_id=request.provider_id,
        status=request.status,
        risk_level=request.risk_level,
        data=request.data,
        created_at=iso(request.created_at),
        updated_at=iso(request.updated_at),
    )


def task_out(db: Session, task: Task) -> TaskOut:
    events = db.scalars(
        select(TaskEvent).where(TaskEvent.task_id == task.id).order_by(TaskEvent.created_at.asc())
    ).all()
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        category=task.category,
        intent=task.intent,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        data=task.data,
        created_at=iso(task.created_at),
        updated_at=iso(task.updated_at),
        events=[event_out(event) for event in events],
    )


def capability_http_error(exc: CapabilityError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"message": exc.message, "code": exc.code, **exc.data},
    )


def get_owned_task(db: Session, user: User, task_id: str) -> Task:
    task = db.scalar(select(Task).where(and_(Task.id == task_id, Task.user_id == user.id)))
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def conversation_out(conversation: Conversation) -> ConversationOut:
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        state=conversation.state,
        context=conversation.context,
        created_at=iso(conversation.created_at),
        updated_at=iso(conversation.updated_at),
        messages=[message_out(message) for message in conversation.messages],
    )


def get_owned_conversation(db: Session, user: User, conversation_id: str) -> Conversation:
    conversation = db.scalar(
        select(Conversation).where(
            and_(Conversation.id == conversation_id, Conversation.user_id == user.id)
        )
    )
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


@router.post("/auth/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    check_auth_rate_limit(f"register-ip:{client_bucket(request)}")
    check_auth_rate_limit(f"register:{payload.email.lower()}")
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        locale=payload.locale,
    )
    db.add(user)
    db.flush()
    db.add(UserPreference(user_id=user.id, data={}))
    refresh = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(refresh)))
    db.add(AuditLog(user_id=user.id, action="auth.register", data={"email": user.email}))
    track_product_event(db, user.id, "signup_completed", {"locale": user.locale})
    db.commit()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=refresh)


@router.post("/auth/login", response_model=TokenPair)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    check_auth_rate_limit(f"login-ip:{client_bucket(request)}")
    check_auth_rate_limit(f"login:{payload.email.lower()}")
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    refresh = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(refresh)))
    db.add(AuditLog(user_id=user.id, action="auth.login", data={}))
    db.commit()
    return TokenPair(access_token=create_access_token(user.id), refresh_token=refresh)


@router.post("/auth/refresh", response_model=TokenPair)
def refresh_token(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    check_auth_rate_limit(f"refresh-ip:{client_bucket(request)}")
    check_auth_rate_limit(f"refresh:{token_hash(payload.refresh_token)}")
    try:
        decoded = decode_token(payload.refresh_token, settings.jwt_refresh_secret, "refresh")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    refresh_hash = token_hash(payload.refresh_token)
    result = db.execute(
        update(RefreshToken)
        .where(and_(RefreshToken.token_hash == refresh_hash, RefreshToken.revoked.is_(False)))
        .values(revoked=True)
    )
    if result.rowcount != 1:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    new_refresh = create_refresh_token(decoded["sub"])
    db.add(RefreshToken(user_id=decoded["sub"], token_hash=token_hash(new_refresh)))
    db.add(AuditLog(user_id=decoded["sub"], action="auth.refresh", data={}))
    db.commit()
    return TokenPair(access_token=create_access_token(decoded["sub"]), refresh_token=new_refresh)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(payload.refresh_token)))
    if stored and stored.user_id == user.id:
        stored.revoked = True
    db.add(AuditLog(user_id=user.id, action="auth.logout", data={}))
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    for field in ["full_name", "locale", "timezone"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    conversation = Conversation(user_id=user.id, title=payload.title or "New request", context={})
    db.add(conversation)
    db.flush()
    track_product_event(db, user.id, "conversation_started", {"conversation_id": conversation.id})
    db.commit()
    db.refresh(conversation)
    return conversation_out(conversation)


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ConversationOut]:
    conversations = db.scalars(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc())
    ).all()
    return [conversation_out(conversation) for conversation in conversations]


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    return conversation_out(get_owned_conversation(db, user, conversation_id))


@router.post("/conversations/{conversation_id}/messages", response_model=AIMessageResponse)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIMessageResponse:
    conversation = get_owned_conversation(db, user, conversation_id)
    check_ai_rate_limit(user.id)
    user_message = Message(
        conversation_id=conversation.id,
        user_id=user.id,
        role="user",
        message_type=payload.message_type,
        content=payload.content,
        data={},
    )
    db.add(user_message)
    ai_context = dict(conversation.context or {})
    ai_context["locale"] = user.locale
    ai_context["timezone"] = user.timezone
    flow = await ai_pipeline.run_async(payload.content, ai_context)
    context = dict(conversation.context or {})
    for key, value in flow.context_update.items():
        if value is None:
            context.pop(key, None)
        else:
            context[key] = value
    if flow.state == "needs_info":
        context["last_question"] = flow.response
        context["last_missing_fields"] = flow.intent.missing_fields
    if flow.state == "waiting_confirmation":
        context["last_question_answered"] = True
    conversation.context = context
    assistant_data = {
        "state": flow.state,
        "intent": flow.intent.model_dump(),
        "proposed_task": flow.proposed_task.model_dump() if flow.proposed_task else None,
        "ai": flow.metadata.model_dump(),
    }
    assistant = Message(
        conversation_id=conversation.id,
        user_id=None,
        role="assistant",
        message_type="assistant",
        content=flow.response,
        data=assistant_data,
    )
    db.add(assistant)
    safe_ai_metadata = {
        "provider": flow.metadata.provider,
        "model": flow.metadata.model,
        "latency_ms": flow.metadata.latency_ms,
        "success": flow.metadata.success,
        "fallback_used": flow.metadata.fallback_used,
        "error_type": flow.metadata.error_type,
        "intent": flow.intent.intent,
        "category": flow.intent.category,
        "language": flow.intent.language,
        "confidence": flow.intent.confidence,
        "missing_fields": flow.intent.missing_fields,
        "token_usage": flow.metadata.token_usage,
    }
    db.add(AuditLog(user_id=user.id, action="ai.intent_processed", data=safe_ai_metadata))
    track_product_event(
        db,
        user.id,
        "intent_detected",
        {
            "conversation_id": conversation.id,
            "intent": flow.intent.intent,
            "category": flow.intent.category,
            "language": flow.intent.language,
            "next_action": flow.intent.next_action,
        },
    )
    if flow.state == "needs_info":
        track_product_event(
            db,
            user.id,
            "clarification_requested",
            {"conversation_id": conversation.id, "missing_fields": flow.intent.missing_fields},
        )
        db.add(
            AuditLog(
                user_id=user.id,
                action="ai.question_asked",
                data={"intent": flow.intent.intent, "missing_fields": flow.intent.missing_fields},
            )
        )
    if flow.state == "waiting_confirmation":
        db.add(AuditLog(user_id=user.id, action="ai.confirmation_required", data=safe_ai_metadata))
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant)
    return AIMessageResponse(
        user_message=message_out(user_message),
        assistant_message=message_out(assistant),
        state=flow.state,
        intent=flow.intent.model_dump(),
        proposed_task=flow.proposed_task.model_dump() if flow.proposed_task else None,
    )


@router.post("/conversations/{conversation_id}/confirm-task", response_model=TaskOut)
def confirm_conversation_task(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    conversation = get_owned_conversation(db, user, conversation_id)
    pending_task = (conversation.context or {}).get("pending_task")
    if not pending_task:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No task is waiting for confirmation")
    task_data = dict(pending_task.get("metadata", {}))
    task_data["constraints"] = pending_task.get("constraints", [])
    task_data["next_action"] = pending_task.get("next_action")
    task_data["next_capability"] = pending_task.get("suggested_capability") or task_data.get("next_capability")
    task = Task(
        user_id=user.id,
        conversation_id=conversation.id,
        title=pending_task["title"],
        description=pending_task["description"],
        category=pending_task["category"],
        intent=pending_task["intent"],
        status="PLANNED",
        priority=pending_task.get("priority", "normal"),
        due_date=pending_task.get("due_date"),
        data=task_data,
    )
    db.add(task)
    db.flush()
    task.status = "CONFIRMED"
    add_task_event(db, task, "created", "Task created from NOVA conversation.")
    if (conversation.context or {}).get("last_question"):
        add_task_event(
            db,
            task,
            "clarification_requested",
            "NOVA asked for the minimum missing information.",
            {"question": conversation.context.get("last_question")},
        )
    if (conversation.context or {}).get("last_question_answered"):
        add_task_event(db, task, "information_received", "The user provided the missing information.")
    add_task_event(db, task, "plan_created", "NOVA prepared a task plan.", task.data)
    add_task_event(db, task, "confirmation_requested", "NOVA requested confirmation before creating the task.")
    add_task_event(db, task, "confirmed", "The user confirmed task creation.")
    db.add(
        Notification(
            user_id=user.id,
            task_id=task.id,
            title=f"Reminder: {task.title}",
            body="NOVA prepared this task. You can track it from Tasks.",
            data={"source": "task_confirmation"},
        )
    )
    db.add(
        ToolExecution(
            user_id=user.id,
            tool_name="TaskTool",
            risk_level="LOW",
            status="completed",
            input_data=pending_task,
            output_data={"task_id": task.id},
        )
    )
    track_product_event(db, user.id, "task_created", {"task_id": task.id, "source": "conversation"})
    track_product_event(db, user.id, "task_confirmed", {"task_id": task.id})
    context = dict(conversation.context or {})
    context.pop("pending_task", None)
    context.pop("last_question", None)
    context.pop("last_missing_fields", None)
    context.pop("last_question_answered", None)
    context["last_task_id"] = task.id
    conversation.context = context
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/tasks/{task_id}/start", response_model=TaskOut)
def start_task(
    task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TaskOut:
    task = get_owned_task(db, user, task_id)
    if task.status == "IN_PROGRESS":
        return task_out(db, task)
    transition_task(db, task, "IN_PROGRESS", "started", "Task started.")
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    task = Task(user_id=user.id, **payload.model_dump(), status="CONFIRMED")
    db.add(task)
    db.flush()
    add_task_event(db, task, "created", "Task created manually.")
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TaskOut]:
    tasks = db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc())).all()
    return [task_out(db, task) for task in tasks]


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TaskOut:
    return task_out(db, get_owned_task(db, user, task_id))


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    task = get_owned_task(db, user, task_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    add_task_event(db, task, "updated", "Task details updated.")
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/tasks/{task_id}/complete", response_model=TaskOut)
def complete_task(
    task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TaskOut:
    task = get_owned_task(db, user, task_id)
    if task.status == "COMPLETED":
        return task_out(db, task)
    transition_task(db, task, "COMPLETED", "completed", "Task marked as completed.")
    track_product_event(db, user.id, "task_completed", {"task_id": task.id})
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/tasks/{task_id}/cancel", response_model=TaskOut)
def cancel_task(
    task_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> TaskOut:
    task = get_owned_task(db, user, task_id)
    if task.status == "CANCELLED":
        return task_out(db, task)
    transition_task(db, task, "CANCELLED", "cancelled", "Task cancelled.")
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/memories", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
def create_memory(
    payload: MemoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoryOut:
    memory = Memory(user_id=user.id, **payload.model_dump())
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory_out(memory)


@router.get("/memories", response_model=list[MemoryOut])
def list_memories(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MemoryOut]:
    memories = db.scalars(select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at.desc())).all()
    return [memory_out(memory) for memory in memories]


@router.delete("/memories/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    memory = db.scalar(select(Memory).where(and_(Memory.id == memory_id, Memory.user_id == user.id)))
    if memory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    db.delete(memory)
    db.commit()


@router.get("/capabilities", response_model=list[CapabilityOut])
def capabilities() -> list[CapabilityOut]:
    return [CapabilityOut(**item) for item in capability_registry.list_public()]


@router.get("/service-categories", response_model=list[ServiceCategoryOut])
def service_categories(db: Session = Depends(get_db)) -> list[ServiceCategoryOut]:
    categories = db.scalars(select(ServiceCategory).order_by(ServiceCategory.name.asc())).all()
    return [ServiceCategoryOut(**category.__dict__) for category in categories]


def provider_services(db: Session, provider_id: str) -> list[str]:
    rows = db.execute(
        select(ServiceCategory.name)
        .join(ProviderService, ProviderService.category_id == ServiceCategory.id)
        .where(ProviderService.provider_id == provider_id)
    ).all()
    return [row[0] for row in rows]


def provider_services_by_id(db: Session, provider_ids: list[str]) -> dict[str, list[str]]:
    if not provider_ids:
        return {}
    rows = db.execute(
        select(ProviderService.provider_id, ServiceCategory.name)
        .join(ServiceCategory, ServiceCategory.id == ProviderService.category_id)
        .where(ProviderService.provider_id.in_(provider_ids))
    ).all()
    services: dict[str, list[str]] = {provider_id: [] for provider_id in provider_ids}
    for provider_id, service_name in rows:
        services.setdefault(provider_id, []).append(service_name)
    return services


def provider_out(db: Session, provider: Provider, services: list[str] | None = None, category: str | None = None) -> ProviderOut:
    return ProviderOut(
        id=provider.id,
        name=provider.name,
        description=provider.description,
        location=provider.location,
        verified=provider.verified,
        demo=provider.demo,
        rating=provider.rating,
        review_count=provider.review_count,
        services=services if services is not None else provider_services(db, provider.id),
        is_demo=provider.demo,
        availability=None,
        price=None,
        category=category,
    )


@router.get("/providers", response_model=list[ProviderOut])
def providers(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ProviderOut]:
    query = select(Provider).order_by(Provider.name.asc())
    if category:
        query = (
            select(Provider)
            .join(ProviderService, ProviderService.provider_id == Provider.id)
            .join(ServiceCategory, ServiceCategory.id == ProviderService.category_id)
            .where(ServiceCategory.slug == category)
            .order_by(Provider.name.asc())
        )
    items = db.scalars(query).all()
    services = provider_services_by_id(db, [item.id for item in items])
    return [provider_out(db, item, services.get(item.id, []), category) for item in items]


@router.get("/providers/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: str, db: Session = Depends(get_db)) -> ProviderOut:
    provider = db.get(Provider, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider_out(db, provider)


def provider_search_result(provider: Provider, category: str) -> ProviderSearchResult:
    return ProviderSearchResult(
        id=provider.id,
        name=provider.name,
        category=category,
        location=provider.location,
        is_demo=provider.demo,
        availability=None,
        rating=provider.rating,
        price=None,
        description=provider.description,
        message="Demo information only — no real-time availability, price, rating, review, or booking is connected.",
    )


def search_service_providers(db: Session, category: str, location: str) -> list[ProviderSearchResult]:
    normalized_location = location.strip().lower()
    rows = db.scalars(
        select(Provider)
        .join(ProviderService, ProviderService.provider_id == Provider.id)
        .join(ServiceCategory, ServiceCategory.id == ProviderService.category_id)
        .where(ServiceCategory.slug == category)
        .where(func.lower(Provider.location) == normalized_location)
        .order_by(Provider.demo.desc(), Provider.name.asc())
    ).all()
    return [provider_search_result(provider, category) for provider in rows]


@router.get("/service-discovery", response_model=ServiceDiscoveryResponse)
def service_discovery(
    category: str,
    location: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceDiscoveryResponse:
    try:
        capability_registry.validate_inputs("search_services", {"category": category, "location": location})
    except CapabilityError as exc:
        raise capability_http_error(exc) from exc
    track_product_event(db, user.id, "service_search_started", {"category": category, "has_location": True})
    results = search_service_providers(db, category, location)
    db.add(
        ToolExecution(
            user_id=user.id,
            tool_name="search_services",
            risk_level="READ_ONLY",
            status="completed",
            input_data={"category": category, "location": location},
            output_data={"result_count": len(results), "external_action_executed": False},
        )
    )
    track_product_event(
        db,
        user.id,
        "service_results_viewed",
        {"category": category, "has_location": True, "result_count": len(results)},
    )
    db.commit()
    return ServiceDiscoveryResponse(
        capability="search_services",
        category=category,
        location=location,
        is_demo=True,
        message="Demo service discovery only. Real provider availability, prices, ratings, reviews, and booking are not connected yet.",
        results=results,
    )


@router.post("/tasks/{task_id}/search-services", response_model=ServiceDiscoveryResponse)
def search_services_for_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceDiscoveryResponse:
    task = get_owned_task(db, user, task_id)
    entities = (task.data or {}).get("entities", {})
    category = task.category
    location = entities.get("location")
    try:
        capability_registry.validate_inputs("search_services", {"category": category, "location": location})
    except CapabilityError as exc:
        raise capability_http_error(exc) from exc
    track_product_event(db, user.id, "service_search_started", {"task_id": task.id, "category": category, "has_location": True})
    results = search_service_providers(db, category, str(location))
    add_task_event(
        db,
        task,
        "service_options_found",
        "NOVA searched demo service options. No provider was contacted.",
        {"capability": "search_services", "result_count": len(results), "is_demo": True},
    )
    db.add(
        ToolExecution(
            user_id=user.id,
            tool_name="search_services",
            risk_level="READ_ONLY",
            status="completed",
            input_data={"task_id": task.id, "category": category, "location": location},
            output_data={"result_count": len(results), "external_action_executed": False},
        )
    )
    task_data = dict(task.data or {})
    task_data["service_search"] = {"category": category, "location": location, "result_count": len(results), "is_demo": True}
    task_data["next_capability"] = "prepare_service_request" if results else "search_services"
    task.data = task_data
    track_product_event(
        db,
        user.id,
        "service_results_viewed",
        {"task_id": task.id, "category": category, "has_location": True, "result_count": len(results)},
    )
    db.commit()
    return ServiceDiscoveryResponse(
        capability="search_services",
        category=category,
        location=str(location),
        is_demo=True,
        message="Demo service discovery available. Real booking is not connected yet.",
        results=results,
    )


def validate_provider_for_service(db: Session, provider_id: str, category: str, location: str) -> Provider:
    provider = db.get(Provider, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    provider_category = db.scalar(
        select(ProviderService)
        .join(Provider, Provider.id == ProviderService.provider_id)
        .join(ServiceCategory, ServiceCategory.id == ProviderService.category_id)
        .where(
            and_(
                ProviderService.provider_id == provider_id,
                ServiceCategory.slug == category,
                func.lower(Provider.location) == location.strip().lower(),
            )
        )
    )
    if provider_category is None:
        raise HTTPException(status_code=422, detail="Provider does not support this category and location")
    return provider


@router.post("/tasks/{task_id}/select-provider", response_model=TaskOut)
def select_provider_for_task(
    task_id: str,
    payload: ProviderSelectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    task = get_owned_task(db, user, task_id)
    entities = (task.data or {}).get("entities", {})
    category = task.category
    location = str(entities.get("location") or "")
    try:
        capability_registry.validate_inputs("prepare_service_request", {"category": category, "location": location})
    except CapabilityError as exc:
        raise capability_http_error(exc) from exc
    provider = validate_provider_for_service(db, payload.provider_id, category, location)
    when = task.due_date
    task_data = dict(task.data or {})
    current_request = task_data.get("service_request") or {}
    current_request_id = current_request.get("id")
    if current_request_id:
        existing_request = db.get(ServiceRequest, current_request_id)
        if (
            existing_request is not None
            and existing_request.user_id == user.id
            and existing_request.task_id == task.id
            and existing_request.provider_id == provider.id
            and existing_request.status in {"PREPARED", "CONFIRMED"}
        ):
            return task_out(db, task)
    request = ServiceRequest(
        user_id=user.id,
        task_id=task.id,
        provider_id=provider.id,
        status="PREPARED",
        risk_level="LOW",
        data={
            "category": category,
            "location": location,
            "when": when,
            "constraints": task_data.get("constraints", []),
            "provider": {
                "id": provider.id,
                "name": provider.name,
                "location": provider.location,
                "is_demo": provider.demo,
            },
            "external_action_executed": False,
        },
    )
    db.add(request)
    db.flush()
    task_data["selected_provider"] = {
        "id": provider.id,
        "name": provider.name,
        "location": provider.location,
        "is_demo": provider.demo,
    }
    task_data["service_request"] = {
        "id": request.id,
        "status": request.status,
        "risk_level": request.risk_level,
        "external_action_executed": False,
    }
    task_data["next_capability"] = "confirm_service_request"
    task.data = task_data
    add_task_event(
        db,
        task,
        "provider_selected",
        "The user selected a demo provider. No booking was made.",
        {"provider_id": provider.id, "provider_name": provider.name, "is_demo": provider.demo},
    )
    add_task_event(
        db,
        task,
        "service_request_prepared",
        "NOVA prepared an internal service request. No provider was contacted.",
        {"service_request_id": request.id, "provider_id": provider.id, "status": request.status},
    )
    db.add(
        ToolExecution(
            user_id=user.id,
            tool_name="prepare_service_request",
            risk_level="LOW",
            status="completed",
            input_data={"task_id": task.id, "provider_id": provider.id},
            output_data={"service_request_id": request.id, "external_action_executed": False},
        )
    )
    track_product_event(db, user.id, "provider_selected", {"task_id": task.id, "provider_id": provider.id, "is_demo": provider.demo})
    track_product_event(db, user.id, "service_request_prepared", {"task_id": task.id, "service_request_id": request.id})
    db.commit()
    db.refresh(task)
    return task_out(db, task)


@router.post("/service-requests", status_code=status.HTTP_201_CREATED)
def create_service_request(
    payload: ServiceRequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.task_id:
        task = get_owned_task(db, user, payload.task_id)
        entities = task.data.get("entities", {}) if task.data else {}
        category = payload.category or task.category
        location = payload.location or entities.get("location")
        when = payload.when or task.due_date
        constraints = payload.constraints or task.data.get("constraints", []) if task.data else payload.constraints
    else:
        category = payload.category
        location = payload.location
        when = payload.when
        constraints = payload.constraints
    try:
        capability_registry.validate_inputs("prepare_service_request", {"category": category, "location": location})
    except CapabilityError as exc:
        raise capability_http_error(exc) from exc
    provider = validate_provider_for_service(db, payload.provider_id, category, str(location)) if payload.provider_id else None
    if payload.task_id:
        current_request = (task.data or {}).get("service_request") or {}
        current_request_id = current_request.get("id")
        if current_request_id:
            existing_request = db.get(ServiceRequest, current_request_id)
            if (
                existing_request is not None
                and existing_request.user_id == user.id
                and existing_request.task_id == task.id
                and existing_request.provider_id == payload.provider_id
                and existing_request.status in {"PREPARED", "CONFIRMED"}
            ):
                return {
                    "id": existing_request.id,
                    "status": existing_request.status,
                    "risk_level": existing_request.risk_level,
                    "message": "Service request already prepared. No external provider was contacted or booked.",
                    "data": existing_request.data,
                }
    request = ServiceRequest(
        user_id=user.id,
        task_id=payload.task_id,
        provider_id=payload.provider_id,
        status="PREPARED",
        risk_level="LOW",
        data={
            "note": payload.note,
            "category": category,
            "location": location,
            "when": when,
            "constraints": constraints,
            "external_action_executed": False,
            "provider": {"id": provider.id, "name": provider.name, "location": provider.location, "is_demo": provider.demo}
            if provider
            else None,
        },
    )
    db.add(request)
    db.flush()
    db.add(
        ToolExecution(
            user_id=user.id,
            tool_name="prepare_service_request",
            risk_level="LOW",
            status="completed",
            input_data=payload.model_dump(),
            output_data={"service_request_id": request.id, "external_action_executed": False},
        )
    )
    if payload.task_id:
        task_data = dict(task.data or {})
        if provider:
            task_data["selected_provider"] = {
                "id": provider.id,
                "name": provider.name,
                "location": provider.location,
                "is_demo": provider.demo,
            }
        task_data["service_request"] = {"id": request.id, "status": request.status, "risk_level": request.risk_level}
        task_data["next_capability"] = "confirm_service_request"
        task.data = task_data
        add_task_event(
            db,
            task,
            "service_request_prepared",
            "NOVA prepared an internal service request. No provider was contacted.",
            {"service_request_id": request.id, "provider_id": payload.provider_id, "status": request.status},
        )
    track_product_event(db, user.id, "service_request_prepared", {"task_id": payload.task_id, "service_request_id": request.id})
    db.commit()
    return {
        "id": request.id,
        "status": request.status,
        "risk_level": request.risk_level,
        "message": "Service request prepared. No external provider was contacted or booked.",
        "data": request.data,
    }


def get_owned_service_request(db: Session, user: User, service_request_id: str) -> ServiceRequest:
    request = db.scalar(
        select(ServiceRequest).where(and_(ServiceRequest.id == service_request_id, ServiceRequest.user_id == user.id))
    )
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")
    return request


@router.get("/service-requests/{service_request_id}", response_model=ServiceRequestOut)
def get_service_request(
    service_request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceRequestOut:
    return service_request_out(get_owned_service_request(db, user, service_request_id))


@router.post("/service-requests/{service_request_id}/confirm", response_model=ServiceRequestOut)
def confirm_service_request(
    service_request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ServiceRequestOut:
    request = get_owned_service_request(db, user, service_request_id)
    if request.status not in {"PREPARED", "CONFIRMED"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This request cannot be confirmed.")
    if request.status == "CONFIRMED":
        return service_request_out(request)
    if request.task_id:
        current_task = get_owned_task(db, user, request.task_id)
        current_service_request = (current_task.data or {}).get("service_request") or {}
        if current_service_request.get("id") != request.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This service request is no longer current.")
    request.status = "CONFIRMED"
    data = dict(request.data or {})
    data["external_action_executed"] = False
    data["confirmation_note"] = "Confirmed by user. No real booking was made."
    request.data = data
    if request.task_id:
        task = current_task
        task_data = dict(task.data or {})
        service_request_data = dict(task_data.get("service_request") or {})
        service_request_data["id"] = request.id
        service_request_data["status"] = request.status
        service_request_data["external_action_executed"] = False
        task_data["service_request"] = service_request_data
        task_data["next_capability"] = None
        task.data = task_data
        add_task_event(
            db,
            task,
            "service_request_confirmed",
            "The user confirmed the prepared request. No real booking was made.",
            {"service_request_id": request.id, "status": request.status, "external_action_executed": False},
        )
    track_product_event(db, user.id, "service_request_confirmed", {"service_request_id": request.id, "task_id": request.task_id})
    db.commit()
    db.refresh(request)
    return service_request_out(request)


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NotificationOut]:
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())
    ).all()
    return [notification_out(item) for item in items]


@router.patch("/notifications/{notification_id}", response_model=NotificationOut)
def mark_notification(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    item = db.scalar(select(Notification).where(and_(Notification.id == notification_id, Notification.user_id == user.id)))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    item.status = "read"
    db.commit()
    db.refresh(item)
    return notification_out(item)


@router.post("/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssetOut:
    asset = Asset(user_id=user.id, **payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return AssetOut(**asset.__dict__)


@router.get("/assets", response_model=list[AssetOut])
def list_assets(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AssetOut]:
    assets = db.scalars(select(Asset).where(Asset.user_id == user.id).order_by(Asset.created_at.desc())).all()
    return [AssetOut(**asset.__dict__) for asset in assets]


def admin_page(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)) -> tuple[int, int]:
    return limit, offset


SAFE_AUDIT_KEYS = {
    "provider",
    "model",
    "latency_ms",
    "success",
    "fallback_used",
    "error_type",
    "intent",
    "category",
    "language",
    "confidence",
    "missing_fields",
    "token_usage",
    "conversation_id",
    "task_id",
    "service_request_id",
    "provider_id",
    "source",
    "locale",
    "status",
    "has_location",
    "result_count",
    "is_demo",
}


def safe_audit_data(data: dict) -> dict:
    return {key: value for key, value in (data or {}).items() if key in SAFE_AUDIT_KEYS}


def page_from_query(db: Session, query, count_query, limit: int, offset: int, serializer) -> AdminPage:
    total = db.scalar(count_query) or 0
    items = db.scalars(query.limit(limit).offset(offset)).all()
    return AdminPage(items=[serializer(item) for item in items], limit=limit, offset=offset, total=total)


def admin_user_item(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "locale": user.locale,
        "timezone": user.timezone,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": iso(user.created_at),
        "updated_at": iso(user.updated_at),
    }


def admin_task_item(task: Task) -> dict:
    return {
        "id": task.id,
        "user_id": task.user_id,
        "conversation_id": task.conversation_id,
        "title": task.title,
        "category": task.category,
        "intent": task.intent,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "created_at": iso(task.created_at),
        "updated_at": iso(task.updated_at),
    }


def admin_service_request_item(item: ServiceRequest) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "task_id": item.task_id,
        "provider_id": item.provider_id,
        "status": item.status,
        "risk_level": item.risk_level,
        "external_action_executed": bool((item.data or {}).get("external_action_executed")),
        "category": (item.data or {}).get("category"),
        "location": (item.data or {}).get("location"),
        "created_at": iso(item.created_at),
        "updated_at": iso(item.updated_at),
    }


def admin_provider_item(item: Provider) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "location": item.location,
        "verified": item.verified,
        "demo": item.demo,
        "rating": item.rating,
        "review_count": item.review_count,
        "created_at": iso(item.created_at),
        "updated_at": iso(item.updated_at),
    }


def admin_audit_item(item: AuditLog) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "action": item.action,
        "data": safe_audit_data(item.data or {}),
        "created_at": iso(item.created_at),
    }


@router.get("/admin/dashboard", response_model=AdminDashboardOut)
def admin_dashboard(
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminDashboardOut:
    recent_cutoff = datetime.now(UTC) - timedelta(days=7)
    status_rows = db.execute(select(Task.status, func.count()).group_by(Task.status)).all()
    tasks_by_status = {status_name: count for status_name, count in status_rows}
    ai_intent_events = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "ai.intent_processed")) or 0
    fallback_events = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.action == "ai.intent_processed",
            AuditLog.data["fallback_used"].as_boolean().is_(True),
        )
    ) or 0
    return AdminDashboardOut(
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        users_created_recently=db.scalar(select(func.count()).select_from(User).where(User.created_at >= recent_cutoff)) or 0,
        total_tasks=db.scalar(select(func.count()).select_from(Task)) or 0,
        tasks_by_status=tasks_by_status,
        completed_tasks=tasks_by_status.get("COMPLETED", 0),
        service_requests=db.scalar(select(func.count()).select_from(ServiceRequest)) or 0,
        confirmed_service_requests=db.scalar(select(func.count()).select_from(ServiceRequest).where(ServiceRequest.status == "CONFIRMED")) or 0,
        provider_selections=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "product.provider_selected")) or 0,
        ai_intent_events=ai_intent_events,
        clarification_events=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "product.clarification_requested")) or 0,
        fallback_events=fallback_events,
        unavailable_metrics=["real_provider_bookings", "payments", "external_provider_contacts"],
    )


@router.get("/admin/users", response_model=AdminPage)
def admin_users(
    pagination: tuple[int, int] = Depends(admin_page),
    role: str | None = Query(default=None, max_length=32),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(User).order_by(User.created_at.desc(), User.id.asc())
    count_query = select(func.count()).select_from(User)
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    return page_from_query(db, query, count_query, limit, offset, admin_user_item)


@router.get("/admin/users/{user_id}")
def admin_user_detail(
    user_id: str,
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(User, user_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return admin_user_item(item)


@router.get("/admin/tasks", response_model=AdminPage)
def admin_tasks(
    pagination: tuple[int, int] = Depends(admin_page),
    status_filter: str | None = Query(default=None, alias="status", max_length=40),
    user_id: str | None = Query(default=None, max_length=36),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(Task).order_by(Task.created_at.desc(), Task.id.asc())
    count_query = select(func.count()).select_from(Task)
    if status_filter:
        query = query.where(Task.status == status_filter)
        count_query = count_query.where(Task.status == status_filter)
    if user_id:
        query = query.where(Task.user_id == user_id)
        count_query = count_query.where(Task.user_id == user_id)
    return page_from_query(db, query, count_query, limit, offset, admin_task_item)


@router.get("/admin/service-requests", response_model=AdminPage)
def admin_service_requests(
    pagination: tuple[int, int] = Depends(admin_page),
    status_filter: str | None = Query(default=None, alias="status", max_length=40),
    user_id: str | None = Query(default=None, max_length=36),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(ServiceRequest).order_by(ServiceRequest.created_at.desc(), ServiceRequest.id.asc())
    count_query = select(func.count()).select_from(ServiceRequest)
    if status_filter:
        query = query.where(ServiceRequest.status == status_filter)
        count_query = count_query.where(ServiceRequest.status == status_filter)
    if user_id:
        query = query.where(ServiceRequest.user_id == user_id)
        count_query = count_query.where(ServiceRequest.user_id == user_id)
    return page_from_query(db, query, count_query, limit, offset, admin_service_request_item)


@router.get("/admin/providers", response_model=AdminPage)
def admin_providers(
    pagination: tuple[int, int] = Depends(admin_page),
    demo: bool | None = Query(default=None),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(Provider).order_by(Provider.name.asc(), Provider.id.asc())
    count_query = select(func.count()).select_from(Provider)
    if demo is not None:
        query = query.where(Provider.demo.is_(demo))
        count_query = count_query.where(Provider.demo.is_(demo))
    return page_from_query(db, query, count_query, limit, offset, admin_provider_item)


@router.get("/admin/audit-logs", response_model=AdminPage)
def admin_audit_logs(
    pagination: tuple[int, int] = Depends(admin_page),
    action: str | None = Query(default=None, max_length=120),
    user_id: str | None = Query(default=None, max_length=36),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.asc())
    count_query = select(func.count()).select_from(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    return page_from_query(db, query, count_query, limit, offset, admin_audit_item)


@router.get("/admin/analytics", response_model=AdminPage)
def admin_analytics(
    pagination: tuple[int, int] = Depends(admin_page),
    action: str | None = Query(default=None, max_length=120),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(AuditLog).where(AuditLog.action.like("product.%")).order_by(AuditLog.created_at.desc(), AuditLog.id.asc())
    count_query = select(func.count()).select_from(AuditLog).where(AuditLog.action.like("product.%"))
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    return page_from_query(db, query, count_query, limit, offset, admin_audit_item)


@router.get("/admin/ai-events", response_model=AdminPage)
def admin_ai_events(
    pagination: tuple[int, int] = Depends(admin_page),
    admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> AdminPage:
    limit, offset = pagination
    query = select(AuditLog).where(AuditLog.action.like("ai.%")).order_by(AuditLog.created_at.desc(), AuditLog.id.asc())
    count_query = select(func.count()).select_from(AuditLog).where(AuditLog.action.like("ai.%"))
    return page_from_query(db, query, count_query, limit, offset, admin_audit_item)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "time": datetime.now(UTC).isoformat()}
