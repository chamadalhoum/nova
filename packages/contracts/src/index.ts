export type TaskStatus =
  | "DRAFT"
  | "NEEDS_INFO"
  | "PLANNED"
  | "SEARCHING"
  | "WAITING_CONFIRMATION"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type TaskEventType =
  | "created"
  | "clarification_requested"
  | "information_received"
  | "plan_created"
  | "confirmation_requested"
  | "confirmed"
  | "updated"
  | "started"
  | "completed"
  | "cancelled"
  | "service_options_found"
  | "provider_selected"
  | "service_request_prepared"
  | "service_request_confirmed"
  | string;

export type ServiceRequestStatus = "PREPARED" | "CONFIRMED" | string;

export type RiskLevel = "READ_ONLY" | "LOW" | "MEDIUM" | "HIGH";
export type CapabilityName =
  | "create_task"
  | "search_services"
  | "prepare_service_request"
  | "confirm_service_request"
  | "compare_providers"
  | "set_reminder"
  | "manage_memory"
  | "manage_asset"
  | "send_external_request"
  | "booking"
  | "payment";

export interface NovaCapability {
  name: CapabilityName | string;
  description: string;
  risk_level: RiskLevel;
  required_permissions: string[];
  required_inputs: string[];
  confirmation_required: boolean;
  enabled: boolean;
}

export type NovaIntent =
  | "service_request"
  | "product_search"
  | "appointment"
  | "planning"
  | "task_management"
  | "document_help"
  | "unknown";

export interface NovaIntentResult {
  intent: NovaIntent;
  category: string | null;
  language: string;
  entities: Record<string, string | number | boolean>;
  constraints: string[];
  missing_fields: string[];
  confidence: number;
  next_action?: string | null;
  suggested_capability?: CapabilityName | string | null;
}

export interface NovaAIMetadata {
  provider: string;
  model?: string | null;
  latency_ms?: number | null;
  success: boolean;
  fallback_used: boolean;
  error_type?: string | null;
  token_usage?: Record<string, number | null> | null;
}

export interface NovaTask {
  id: string;
  title: string;
  description: string;
  category: string;
  intent: NovaIntent | string;
  status: TaskStatus;
  priority: string;
  due_date?: string | null;
  data: { entities?: Record<string, string>; next_capability?: string; next_action?: string; [key: string]: unknown };
  created_at?: string;
  updated_at?: string;
  events: NovaTaskEvent[];
}

export interface NovaTaskEvent {
  id: string;
  event_type: TaskEventType;
  message: string;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface NovaTaskPlan {
  title: string;
  description: string;
  category: string;
  intent: NovaIntent | string;
  priority: string;
  due_date?: string | null;
  location?: string | null;
  constraints: string[];
  missing_fields: string[];
  next_action: string;
  suggested_capability?: CapabilityName | string | null;
  metadata: Record<string, unknown>;
}

export interface NovaProviderSearchResult {
  id: string;
  name: string;
  category: string;
  location: string;
  is_demo: boolean;
  availability: null;
  rating: number | null;
  price: null;
  description: string;
  message: string;
}

export interface NovaProvider {
  id: string;
  name: string;
  description: string;
  location: string;
  verified: boolean;
  demo: boolean;
  rating: number | null;
  review_count: number | null;
  services: string[];
  is_demo: boolean;
  availability: null;
  price: null;
  category?: string | null;
}

export interface NovaServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface NovaServiceDiscoveryResponse {
  capability: "search_services";
  category: string;
  location: string;
  is_demo: boolean;
  message: string;
  results: NovaProviderSearchResult[];
}

export interface NovaServiceRequest {
  id: string;
  task_id: string | null;
  provider_id: string | null;
  status: ServiceRequestStatus;
  risk_level: RiskLevel;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NovaTokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: "bearer" | string;
}

export interface NovaUser {
  id: string;
  email: string;
  full_name: string | null;
  locale: string;
  timezone: string;
  role: "user" | "admin" | string;
}

export interface NovaConversation {
  id: string;
  title: string;
  state: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  messages: NovaMessage[];
}

export interface NovaMessage {
  id: string;
  role: string;
  message_type: string;
  content: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface NovaAIMessageResponse {
  user_message: NovaMessage;
  assistant_message: NovaMessage;
  state: string;
  intent?: NovaIntentResult | Record<string, unknown> | null;
  proposed_task?: NovaTaskPlan | Record<string, unknown> | null;
  task_id?: string | null;
}

export interface NovaMemory {
  id: string;
  type: string;
  key: string;
  value: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface NovaNotification {
  id: string;
  title: string;
  body: string;
  status: string;
  remind_at: string | null;
  created_at: string;
}

export interface NovaAsset {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  notes: string | null;
}

export interface NovaApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
  detail?: string | Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface NovaAdminPage<T> {
  items: T[];
  limit: number;
  offset: number;
  total: number;
}

export interface NovaAdminDashboard {
  total_users: number;
  users_created_recently: number;
  total_tasks: number;
  tasks_by_status: Record<string, number>;
  completed_tasks: number;
  service_requests: number;
  confirmed_service_requests: number;
  provider_selections: number;
  ai_intent_events: number;
  clarification_events: number;
  fallback_events: number;
  unavailable_metrics: string[];
}

export interface NovaAdminUser {
  id: string;
  email: string;
  full_name: string | null;
  locale: string;
  timezone: string;
  role: "user" | "admin" | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NovaAdminTask {
  id: string;
  user_id: string;
  conversation_id: string | null;
  title: string;
  category: string;
  intent: string;
  status: TaskStatus | string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface NovaAdminServiceRequest {
  id: string;
  user_id: string;
  task_id: string | null;
  provider_id: string | null;
  status: ServiceRequestStatus;
  risk_level: RiskLevel;
  external_action_executed: boolean;
  category?: string | null;
  location?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NovaAdminProvider {
  id: string;
  name: string;
  description: string;
  location: string;
  verified: boolean;
  demo: boolean;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface NovaAdminAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  data: Record<string, unknown>;
  created_at: string;
}
