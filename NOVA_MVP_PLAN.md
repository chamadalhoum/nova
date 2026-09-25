# NOVA MVP Plan

## Current State

The repository is empty except for Git metadata. There is no existing code, architecture, database, Docker setup, frontend, mobile app, backend, README, tests, or CI.

Branch: `master`

Commits: none

Working tree before planning docs: clean

## Problems

The product risk is scope creep, not legacy constraints.

Main risks:

- Building a large marketplace before proving task completion
- Creating too many modules and tables too early
- Duplicating logic across web and mobile
- Making the AI provider too tightly coupled
- Trusting AI output without schema validation
- Hardcoding Tunisia-specific assumptions
- Logging or storing sensitive data unnecessarily
- Creating payment or booking flows before confirmation and trust are solid

## Proposed Architecture

Use a monorepo:

```text
backend/
web/
mobile/
packages/
docs/
```

Backend is the source of truth for:

- Auth
- Users
- Conversations
- Tasks
- Task events
- AI orchestration
- Memory
- Providers
- Tools
- Notifications
- Permissions

Web and mobile should consume `/api/v1/` and share contracts where useful.

## MVP Scope

Build only:

- Signup, login, logout, profile
- Text chat with AI pipeline foundation
- Voice and image interfaces as architecture-ready adapters
- Intent detection
- Dynamic missing-info questions
- Task creation and lifecycle
- Task event history
- Controlled memory for basic preferences
- Reminders
- Basic service category/provider discovery
- Provider details with real or explicitly marked demo data
- Confirmation UX for booking/request intent

Do not build yet:

- Payments
- Full marketplace
- Advanced travel agent
- Universal shopping
- Enterprise
- Complex recommendation engine
- Large integration catalog

## Files To Create

Phase 1 foundation:

```text
README.md
.env.example
.gitignore
docker-compose.yml
backend/pyproject.toml
backend/Dockerfile
backend/app/main.py
backend/app/core/config.py
backend/app/core/database.py
backend/app/core/security.py
backend/app/api/v1/router.py
backend/app/auth/
backend/app/users/
backend/app/conversations/
backend/app/tasks/
backend/app/ai/
backend/app/memory/
backend/app/providers/
backend/app/tools/
backend/app/notifications/
backend/tests/
web/package.json
web/next.config.ts
web/app/
web/components/
web/features/
web/messages/
mobile/package.json
mobile/app.json
mobile/app/
mobile/components/
mobile/features/
mobile/messages/
packages/contracts/
```

Planning docs already created in this step:

```text
NOVA_AUDIT.md
NOVA_PRODUCT.md
NOVA_COMPETITORS.md
NOVA_UX.md
NOVA_ARCHITECTURE.md
NOVA_AI.md
NOVA_ROADMAP.md
NOVA_MVP_PLAN.md
```

## Files To Modify

None currently exist.

Future build phases should modify only files created by that phase and avoid broad rewrites.

## Database Changes

Initial migrations should create:

- users
- user_preferences
- conversations
- messages
- attachments
- tasks
- task_events
- memories
- service_categories
- providers
- provider_services
- service_requests
- notifications
- tool_executions
- audit_logs

Every user-owned table needs `user_id` and authorization-aware access patterns where applicable.

Use PostgreSQL enums or constrained strings for stable statuses only after deciding migration ergonomics.

## API Changes

Initial API surface:

```text
/api/v1/auth/register
/api/v1/auth/login
/api/v1/auth/refresh
/api/v1/auth/logout
/api/v1/me
/api/v1/conversations
/api/v1/conversations/{id}/messages
/api/v1/tasks
/api/v1/tasks/{id}
/api/v1/tasks/{id}/complete
/api/v1/tasks/{id}/cancel
/api/v1/service-categories
/api/v1/providers
/api/v1/providers/{id}
/api/v1/service-requests
/api/v1/notifications
```

OpenAPI schemas must be clean and user-facing errors must be humanized by clients.

## AI Changes

Build AI as components:

- `AIProvider`
- `IntentClassifier`
- `ContextManager`
- `ConfidenceManager`
- `QuestionManager`
- `TaskPlanner`
- `ToolSelector`
- `SafetyGuard`
- `ActionExecutor`
- `MemoryManager`
- `ResponseGenerator`

Use schemas for every AI output used by the system.

MVP can start with a deterministic/rule-based fallback classifier for tests and local development, plus provider adapters behind configuration.

## Mobile Changes

Create a native-feeling Expo app:

- Home with immediate prompt input
- Voice and camera buttons wired to placeholder flows if providers are not configured
- Tasks tab
- Discover tab
- Passport placeholder tab
- Profile tab
- Secure token storage
- i18n foundation with LTR/RTL support

## Web Changes

Create a responsive Next.js app:

- Home with prominent NOVA input
- Task dashboard
- Discover/provider listing
- Passport placeholder
- Notifications
- Profile
- Auth pages
- i18n foundation
- Responsive layouts tested from 320px to 1440px

## Tests

Backend tests:

- Auth registration/login/refresh/logout
- Authorization checks
- Conversation creation and message submission
- Intent classification dataset
- Missing information detection
- Task creation and state transitions
- Task event creation
- Tool permission gates
- Memory create/update/delete controls

Frontend tests:

- Auth screens
- Home prompt submission
- Task empty state
- Task list/detail
- Confirmation UI
- Error states

E2E flows after foundation:

- Signup
- Login
- First AI request
- Create task
- Complete task
- Logout

Quality commands to define later:

- Backend tests
- Backend lint
- Backend type check where useful
- Web lint
- Web type check
- Web build
- Mobile type check
- Docker build

## Risks

- AI cost if every request uses large models
- Poor trust if provider data is demo or stale
- User frustration if NOVA asks too many questions
- Privacy risk if memory is too aggressive
- Architecture bloat if every future module is built in MVP
- Local marketplace cold-start problem

Mitigations:

- Start with text and task creation
- Mark demo data clearly
- Use confirmation gates
- Log task events, not private chain-of-thought
- Keep memory explicit and deletable
- Add integrations only behind tool permissions

## Rollback Strategy

Because the repo is empty, early rollback is straightforward:

- Keep each build phase small
- Avoid destructive migrations until real data exists
- Use Alembic downgrade paths during development
- Keep seeded/demo provider data separate from user data
- Use feature flags or config flags for AI providers and tools
- Do not commit secrets
- Do not introduce payments until confirmation and audit flows are proven

## Build Order After Plan Approval

1. Backend foundation
2. Database models and migrations
3. Authentication
4. AI abstraction and deterministic MVP classifier
5. Conversations
6. Tasks and task events
7. Memory controls
8. Tool registry and permission model
9. Provider discovery MVP
10. Web app foundation
11. Mobile app foundation
12. Notifications/reminders
13. Tests
14. Docker and developer experience
15. QA and responsive checks

No build should start until this plan is reviewed and accepted.
