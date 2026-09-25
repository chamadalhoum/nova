# NOVA

NOVA is an AI-first life agent MVP.

Core promise:

> Tell NOVA what you need. NOVA figures out how to get it done.

The MVP focuses on the critical loop: natural request, understanding, minimal clarification, task confirmation, task creation, tracking, and completion.

## Architecture

```text
mobile/ Expo React Native
web/ Next.js
        |
        v
backend/ FastAPI
        |
        +-- PostgreSQL
        +-- Redis
        +-- AI provider abstraction
```

The backend is the source of truth for authentication, conversations, AI orchestration, task state, memory, tools, providers, and notifications.

V0.4 builds on the backend-controlled capability registry with a polished end-to-end service flow: natural request, clarification, confirmed task, demo service search, provider selection, prepared request, explicit confirmation, and transparent task timeline.

## Repository Structure

```text
backend/          FastAPI API, SQLAlchemy models, Alembic, tests
web/              Next.js web app
mobile/           Expo mobile app
packages/contracts Shared TypeScript API contracts
docs/             Developer notes
```

## Requirements

- Python 3.13+ recommended for Docker backend
- Node.js 24+
- Docker and Docker Compose
- Expo CLI through `npx expo`

Local host Python 3.12 can run the current backend tests, but Docker uses Python 3.13.

## Environment Variables

From the repository root, copy `.env.example` to `.env` for local development and change secrets:

```bash
cd /home/databiz194/Bureau/formation/NOVA
cp .env.example .env
```

```text
DATABASE_URL
REDIS_URL
API_PORT
WEB_PORT
POSTGRES_PORT
REDIS_PORT
JWT_SECRET
JWT_REFRESH_SECRET
AI_MODE
AI_PROVIDER
AI_API_KEY
AI_MODEL
AI_TIMEOUT_SECONDS
CORS_ORIGINS
NEXT_PUBLIC_API_URL
EXPO_PUBLIC_API_URL
```

Never commit real secrets.

## Docker

Start API, PostgreSQL, Redis, and web:

```bash
cd /home/databiz194/Bureau/formation/NOVA
docker compose up --build
```

If local services already use the default ports, override host ports in `.env`, for example `API_PORT=18000`, `WEB_PORT=13000`, `POSTGRES_PORT=55432`, and `REDIS_PORT=56379`.

API docs:

```text
http://localhost:8000/docs
http://localhost:8000/redoc
http://localhost:8000/openapi.json
```

Web:

```text
http://localhost:3000
```

## Backend

Install locally:

```bash
cd /home/databiz194/Bureau/formation/NOVA
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
```

On Ubuntu/Debian, do not install into the system Python environment. PEP 668 marks it as externally managed; use the virtual environment commands above instead.

Run API:

```bash
python -m uvicorn app.main:app --reload
```

Run tests:

```bash
python -m pytest
python -m ruff check .
```

Run the optional live AI smoke test only when token spend is intentional:

```bash
RUN_LIVE_AI_SMOKE=1 AI_API_KEY=... python -m pytest tests/test_live_ai_smoke.py
```

## Database Migrations

Alembic is configured in `backend/alembic.ini`.

The app creates tables at startup only in development/test for greenfield local use. Production deployments should run the explicit initial Alembic migration:

```bash
cd /home/databiz194/Bureau/formation/NOVA/backend
alembic upgrade head
```

## Web

```bash
cd /home/databiz194/Bureau/formation/NOVA
cd web
npm install
npm run dev
npm run lint
npm run build
npm run test
npm run test:e2e
```

`npm run test:e2e` starts a deterministic FastAPI backend on `127.0.0.1:8001` with a fresh SQLite database and seeded demo providers, then starts Next.js on `127.0.0.1:3001` and runs the Playwright service-flow test.

## Mobile

```bash
cd /home/databiz194/Bureau/formation/NOVA
cd mobile
npm install
npx expo start
npm run typecheck
```

Mobile uses Expo Router and the same backend API. Tokens are stored with Expo SecureStore.

For physical devices or Android emulators, set `EXPO_PUBLIC_API_URL` to a reachable backend URL. `localhost` points to the device itself, not your development machine. Common examples are your LAN IP such as `http://192.168.1.20:8000`, or `http://10.0.2.2:8000` for the Android emulator.

## NOVA V0.5 Status

Implemented and validated:

- End-to-end backend service journey from registration through task completion.
- Explicit OpenAI structured-output schema for strict JSON responses.
- Deterministic fallback tests for provider failure, timeout, invalid structured output, and missing API key.
- Redis-backed rate limiting abstraction for auth and AI endpoints with in-memory fallback when Redis is unavailable.
- Web and mobile API clients retry once with refresh-token rotation after an expired access token response.
- Tests for expired access tokens, revoked refresh tokens, unauthorized conversation/memory access, invalid task transitions, stale service request confirmation, duplicate confirmation, wrong provider location/category, and analytics sanitization.
- Focused Playwright browser E2E coverage for the complete demo service flow: register, create task from chat, search seeded demo providers, select provider, confirm the internal request, and complete the task.

Demo-only:

- Provider directory.
- Service discovery results.
- Service request confirmation.

Production-ready foundations:

- Backend-owned authorization and task/service-request state.
- Capability and risk validation.
- Sanitized product analytics events.
- Human-readable API errors for expected failures, with `X-Request-ID` response headers for tracing.
- Shared TypeScript API contracts consumed by web and mobile through `@nova/contracts`.

Intentionally deferred:

- httpOnly cookie authentication. Web still uses session storage in development; backend token rotation and refresh revocation exist, but browser session hardening needs a deliberate cookie/CSRF design.
- Production migration execution and operational migration workflow.
- Full i18n message catalog and RTL layout pass.
- Generating TypeScript contracts automatically from the OpenAPI schema.

Known limitations:

- No real provider booking, contact, availability, prices, reviews, payments, maps, WhatsApp, provider onboarding, RAG, vector DB, LangChain, or multi-agent architecture.
- Redis rate limiting falls back to in-memory counters if Redis is unavailable.
- Database outage behavior is covered by the generic API error boundary, not by a dedicated integration test.

## AI Configuration

V0.2 supports a real LLM provider with deterministic fallback.

Modes:

```text
AI_MODE=deterministic  # always use local deterministic classifier
AI_MODE=real           # try configured LLM, fall back safely on provider failure
AI_MODE=auto           # default: use real provider when configured, fall back when unavailable
```

Provider configuration:

```text
AI_PROVIDER=openai
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_SECONDS=30
```

The OpenAI adapter requests strict structured JSON output and validates it with Pydantic before business logic consumes it. Tests use fake providers and do not require live API calls.

The deterministic provider remains available and is used as fallback when the LLM provider is unavailable, times out, returns malformed output, or has no API key configured.

AI regression coverage lives in `backend/tests/fixtures/ai_intent_eval.json`. The dataset protects English, French, Arabic, Tunisian Arabic, Arabizi, mixed-language, missing-information, ambiguous, appointment, product-search, and service-request cases from being reclassified accidentally.

V0.2.6 keeps structured conversation state instead of relying on raw chat text only. The state tracks current intent, current category, known entities, missing fields, last question, last task, and conversation language so clarification answers and follow-ups can be merged safely.

Live provider smoke testing is opt-in so local and CI runs do not spend tokens by default:

```bash
cd backend
RUN_LIVE_AI_SMOKE=1 AI_API_KEY=... pytest tests/test_live_ai_smoke.py
```

Pipeline:

```text
IntentClassifier
ContextManager
ConfidenceManager
QuestionManager
TaskPlanner
ToolSelector
SafetyGuard
ActionExecutor
ResponseGenerator
```

Future AI providers must implement the `AIProvider` protocol and validate structured outputs with Pydantic before business logic consumes them.

## Capability Engine

NOVA capabilities are registered in the backend, not invented by the LLM. Each capability declares:

```text
name
description
risk_level
required_permissions
required_inputs
confirmation_required
enabled
```

Risk levels:

```text
READ_ONLY  # safe lookup, such as demo service discovery
LOW        # internal draft or task preparation
MEDIUM     # external request, disabled until real integrations exist
HIGH       # booking or payment, disabled until explicitly implemented
```

Current active capabilities include task creation, demo service discovery, internal service request preparation, reminders, controlled memory, and assets. Booking, external provider requests, and payments are present only as disabled definitions.

The LLM may suggest a capability such as `search_services`, but the backend validates that the capability exists, is enabled, has required inputs, and is safe for the current task before anything runs.

## End-to-End Service Flow

V0.4 supports the first complete service experience without pretending to book anything:

```text
Natural request
-> intent and entity extraction
-> minimal clarification if needed
-> task confirmation
-> demo service discovery
-> provider selection
-> internal service request preparation
-> explicit request confirmation
-> task timeline update
```

Example:

```text
N7eb plombier fi Ariana ghodwa.
```

NOVA resolves this to a plumbing service request in Ariana for tomorrow, creates a confirmed task after user approval, searches demo service options, lets the user select a provider, prepares a `PREPARED` service request, and can mark that internal request as `CONFIRMED` after explicit user confirmation.

`CONFIRMED` means the user confirmed the NOVA request. It does not mean a real provider booking happened.

## Service Discovery

Service discovery is database-backed and demo-only:

```text
intent -> service category -> location -> provider query -> demo results
```

Provider results never invent availability, ratings, prices, reviews, or booking confirmations. Demo providers are marked as demo data in API responses and UI.

Provider selection creates or updates an internal service request. It never contacts a provider. Request confirmation keeps `external_action_executed=false` and records task events such as `provider_selected`, `service_request_prepared`, and `service_request_confirmed`.

## Analytics Foundation

V0.4 adds a lightweight product-event abstraction on top of internal audit logs. Events include:

```text
signup_completed
conversation_started
intent_detected
clarification_requested
task_created
task_confirmed
service_search_started
service_results_viewed
provider_selected
service_request_prepared
service_request_confirmed
task_completed
```

Analytics events store IDs, categories, status, language, counts, and safe metadata only. They do not store full private conversation content.

## Critical Flow

1. Register or login
2. Open Chat
3. Send `N7eb wa7ed ysala7li l clim ghodwa`
4. NOVA asks for the missing location
5. Send `Ariana`
6. NOVA asks for confirmation
7. Confirm task creation
8. Open the task
9. Search demo service options
10. Select a demo provider
11. Prepare and confirm the internal service request
12. Return to the task timeline to see what happened

After user confirmation, tasks created from chat use `CONFIRMED`. The task history uses human-readable events such as `created`, `clarification_requested`, `information_received`, `plan_created`, `confirmation_requested`, `confirmed`, `updated`, `service_options_found`, `provider_selected`, `service_request_prepared`, `service_request_confirmed`, `started`, `completed`, and `cancelled`.

## MVP Limitations

- Providers are seeded demo data and clearly marked as demo
- No real booking integration
- No payments
- No real provider availability, ratings, prices, reviews, or external provider contact
- No real speech-to-text or vision provider configured yet
- Auth and AI endpoints use Redis-backed rate limiting with in-memory fallback when Redis is unavailable
- Web currently stores tokens in session storage for development; production should use httpOnly secure cookies with CSRF protection where required
- Shared API types live in `packages/contracts` and are imported by web/mobile as `@nova/contracts`
- Alembic has an explicit initial MVP schema migration; run migrations explicitly before production database use

## NOVA V0.7 Admin And Observability

V0.7 adds a small server-authorized admin surface for operational visibility.

Admin authorization:

- Users have an explicit `role` column. Normal users default to `user`; admins use `admin`.
- Admin APIs are protected server-side with the same JWT authentication flow plus an admin-role check.
- Normal users receive `403 Admin access required` for `/api/v1/admin/...` endpoints.
- There is no public self-promotion endpoint. Admin role assignment is an explicit operational CLI action.

Promote an existing user to admin:

```bash
cd /home/databiz194/Bureau/formation/NOVA/backend
python -m app.cli promote-admin --email user@example.com
```

The command only promotes an existing user. It is idempotent for users who are already admin, returns a safe `not_found` result for unknown users, and never prints passwords, token hashes, or JWTs.

Migration behavior:

- Fresh databases create users with `role="user"` by default.
- Existing databases get `users.role` through Alembic migration `0002_add_user_role`, backfilled to `user`.
- Admin promotion does not require manual SQL.

Admin API endpoints:

```text
GET /api/v1/admin/dashboard
GET /api/v1/admin/users
GET /api/v1/admin/users/{id}
GET /api/v1/admin/tasks
GET /api/v1/admin/service-requests
GET /api/v1/admin/providers
GET /api/v1/admin/audit-logs
GET /api/v1/admin/analytics
GET /api/v1/admin/ai-events
```

Admin list endpoints use `limit` and `offset` pagination with a maximum limit of `100`.

AI observability exposes sanitized operational metadata only: provider, model, latency, success/failure, fallback usage, error type, intent, confidence, and token usage when available. It does not expose raw prompts, full entities, proposed task payloads, API keys, or private user content.

The admin web area lives under `/admin` in the existing Next.js app. It is an operational UI only; backend authorization remains authoritative.

Pipeline idempotency:

- Repeating task start, completion, or cancellation after the task is already in that final state returns the current task instead of adding duplicate timeline events.
- Repeating provider selection for the same current task/provider reuses the existing prepared or confirmed service request.
- Repeating task-scoped service request preparation for the same provider reuses the current request.
- Service request confirmation remains idempotent once the request is already `CONFIRMED`.
