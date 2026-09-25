# NOVA Architecture

## Target Architecture

```text
mobile/ React Native + Expo
web/ Next.js
        |
        | HTTPS
        v
backend/ FastAPI
        |
        +-- PostgreSQL
        +-- Redis
        +-- AI providers
        +-- Tool providers
```

The backend owns business logic. Web and mobile consume the same API and should not duplicate task, permission, AI, memory, or provider logic.

## Monorepo Structure

Recommended initial structure:

```text
backend/
  app/
    api/
    core/
    auth/
    users/
    conversations/
    tasks/
    memory/
    ai/
    tools/
    providers/
    notifications/
    common/
  tests/
  migrations/
  Dockerfile
  pyproject.toml
web/
  app/
  components/
  features/
  lib/
  messages/
mobile/
  app/
  components/
  features/
  lib/
  messages/
packages/
  contracts/
  config/
```

## Backend Modules

Minimum MVP modules:

- `core`: config, logging, security settings, database session
- `auth`: registration, login, refresh, password hashing
- `users`: profile and preferences
- `conversations`: conversations, messages, attachments metadata
- `tasks`: task model, task events, state transitions
- `ai`: provider abstraction and orchestration pipeline
- `memory`: controlled user preferences and context
- `providers`: service categories and provider directory
- `tools`: registry, permissions, executions
- `notifications`: reminders and notification preferences

## Database MVP

Start with the minimum useful schema:

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

Defer until validated:

- payments
- reviews beyond provider seed data
- advanced availability calendar
- advanced household passport
- country-specific payment providers
- enterprise tables

## API Versioning

All API routes should live under:

```text
/api/v1/
```

Initial route groups:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/me
PATCH  /api/v1/me

POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/{id}
POST   /api/v1/conversations/{id}/messages

POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/{id}
PATCH  /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/complete
POST   /api/v1/tasks/{id}/cancel

GET    /api/v1/service-categories
GET    /api/v1/providers
GET    /api/v1/providers/{id}
POST   /api/v1/service-requests

GET    /api/v1/notifications
PATCH  /api/v1/notifications/{id}
```

## Security Architecture

Required from the start:

- Password hashing with a proven algorithm
- Refresh token rotation or equivalent secure session model
- Authorization checks on every user-owned resource
- CORS allowlist from environment
- Rate limiting for auth and AI endpoints
- Request IDs
- Structured audit logs for auth, task, and tool actions
- No secrets in code
- No raw AI tool execution without schema validation and permission checks

## Internationalization Architecture

Core models must support:

- Locale
- Language
- Timezone
- Country
- Region
- City
- Currency

Do not hardcode Tunisia, DT, Tunisian phone formats, or Tunisian cities into core logic.

## Tool Architecture

Tools must be registered and permissioned.

```text
ToolRegistry
ToolDefinition
ToolPermission
ToolExecution
```

Risk levels:

- Read-only: can run automatically when safe
- Low-risk: can create internal drafts/tasks
- Medium-risk: requires contextual confirmation
- High-risk: explicit confirmation required, especially payment or purchase

## Observability

Minimum foundation:

- Structured logs
- Request IDs
- Task event history
- Tool execution logs
- AI request metadata without sensitive payload logging by default
- Error boundary and sanitized API error responses

Never log passwords, tokens, API keys, or unnecessary sensitive data.
