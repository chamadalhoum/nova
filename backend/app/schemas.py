from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=160)
    locale: str = Field(default="en", max_length=16)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=2048)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    locale: str
    timezone: str
    role: str


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=160)
    locale: str | None = Field(default=None, max_length=16)
    timezone: str | None = Field(default=None, max_length=64)


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=180)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    message_type: str = Field(default="text", max_length=32)


class MessageOut(BaseModel):
    id: str
    role: str
    message_type: str
    content: str
    data: dict
    created_at: str


class ConversationOut(BaseModel):
    id: str
    title: str
    state: str
    context: dict
    created_at: str
    updated_at: str
    messages: list[MessageOut] = []


class AIMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    state: str
    intent: dict | None = None
    proposed_task: dict | None = None
    task_id: str | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    description: str = Field(default="", max_length=4000)
    category: str = Field(default="general", max_length=80)
    intent: str = Field(default="unknown", max_length=80)
    priority: str = Field(default="normal", max_length=20)
    due_date: str | None = Field(default=None, max_length=80)
    data: dict = Field(default_factory=dict)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=220)
    description: str | None = Field(default=None, max_length=4000)
    priority: str | None = Field(default=None, max_length=20)
    due_date: str | None = Field(default=None, max_length=80)
    data: dict | None = None


class TaskEventOut(BaseModel):
    id: str
    event_type: str
    message: str
    data: dict
    created_at: str


class TaskOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    intent: str
    status: str
    priority: str
    due_date: str | None
    data: dict
    created_at: str
    updated_at: str
    events: list[TaskEventOut] = []


class CapabilityOut(BaseModel):
    name: str
    description: str
    risk_level: str
    required_permissions: list[str]
    required_inputs: list[str]
    confirmation_required: bool
    enabled: bool


class MemoryCreate(BaseModel):
    type: str = Field(min_length=1, max_length=60)
    key: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=2000)
    source: str = Field(default="user", max_length=120)


class MemoryOut(BaseModel):
    id: str
    type: str
    key: str
    value: str
    source: str
    created_at: str
    updated_at: str


class ServiceCategoryOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str


class ProviderOut(BaseModel):
    id: str
    name: str
    description: str
    location: str
    verified: bool
    demo: bool
    rating: float | None
    review_count: int | None
    services: list[str]
    is_demo: bool
    availability: None = None
    price: None = None
    category: str | None = None


class ProviderSearchResult(BaseModel):
    id: str
    name: str
    category: str
    location: str
    is_demo: bool
    availability: None = None
    rating: float | None = None
    price: None = None
    description: str
    message: str


class ServiceDiscoveryResponse(BaseModel):
    capability: str
    category: str
    location: str
    is_demo: bool
    message: str
    results: list[ProviderSearchResult]


class ServiceRequestCreate(BaseModel):
    task_id: str | None = None
    provider_id: str | None = None
    note: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=160)
    when: str | None = Field(default=None, max_length=80)
    constraints: list[str] = Field(default_factory=list)


class ProviderSelectionCreate(BaseModel):
    provider_id: str = Field(min_length=1)


class ServiceRequestOut(BaseModel):
    id: str
    task_id: str | None
    provider_id: str | None
    status: str
    risk_level: str
    data: dict
    created_at: str
    updated_at: str


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    status: str
    remind_at: str | None
    created_at: str


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    type: str = Field(default="asset", max_length=80)
    brand: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)


class AssetOut(BaseModel):
    id: str
    name: str
    type: str
    brand: str | None
    model: str | None
    notes: str | None


class AdminPage(BaseModel):
    items: list[dict]
    limit: int
    offset: int
    total: int


class AdminDashboardOut(BaseModel):
    total_users: int
    users_created_recently: int
    total_tasks: int
    tasks_by_status: dict[str, int]
    completed_tasks: int
    service_requests: int
    confirmed_service_requests: int
    provider_selections: int
    ai_intent_events: int
    clarification_events: int
    fallback_events: int
    unavailable_metrics: list[str]
