# Development Notes

The MVP implementation is intentionally narrow. The task loop is the product center:

```text
Natural request -> understanding -> clarification -> confirmation -> task -> tracking -> completion
```

Provider discovery is demo-only until real supply, verification, availability, and pricing exist.

AI integrations must remain behind provider and tool boundaries. The LLM must never execute shell commands, SQL, arbitrary HTTP calls, payments, or bookings directly.

V0.2 AI execution stores only safe metadata: provider, model, latency, success/failure, fallback flag, intent, confidence, and token usage when available. Do not log API keys, tokens, passwords, or full private prompts by default.

AI regression cases are versioned in `backend/tests/fixtures/ai_intent_eval.json`. Add narrow examples there when changing intent classification, especially for mixed-language or clarification flows.

The optional live provider smoke test is skipped unless both `RUN_LIVE_AI_SMOKE=1` and `AI_API_KEY` are set. Keep it out of default CI unless token spend and provider availability are intentional.

V0.2.6 conversation context is structured. Preserve these keys when changing the AI pipeline: `current_intent`, `current_category`, `known_entities`, `missing_fields`, `last_question`, `last_task_id`, and `conversation_language`. Follow-up messages should enrich the pending task unless there is a clear reset signal or a strong different intent.

Task status and timeline are user-facing product state. Chat-created tasks become `CONFIRMED` only after the user approves the proposed task. Use stable event names: `created`, `clarification_requested`, `information_received`, `plan_created`, `confirmation_requested`, `confirmed`, `updated`, `service_options_found`, `provider_selected`, `service_request_prepared`, `service_request_confirmed`, `started`, `completed`, and `cancelled`.

Memory remains controlled. Do not automatically persist temporary context such as “today I am in Sousse” as a durable preference. User-created memories should be displayed in human language, not implementation terms.

V0.3 capability execution is backend-controlled. Add or change capabilities in `app/capabilities/registry.py`; do not hardcode capability availability in prompts or clients. Every executable capability needs declared risk, required inputs, confirmation requirement, and enabled state.

The LLM may return `next_action` or `suggested_capability`, but backend validation is authoritative. Unsupported or disabled capabilities must produce a human-safe message such as “I can prepare this request, but this action is not available yet.”

Service discovery is deterministic and database-backed. Query providers by category and location using backend endpoints. Do not use LLM calls, RAG, embeddings, external maps, marketplace APIs, or provider APIs for service discovery.

Demo provider rules:
- Keep `demo=true` for seeded providers.
- Do not invent availability, prices, ratings, reviews, verification, or booking confirmations.
- Service requests are `PREPARED` internal records unless a real external integration is explicitly added in a later phase.
- `CONFIRMED` service requests mean the user confirmed the internal NOVA request only. They do not mean booked.

Capability risk levels:
- `READ_ONLY`: lookup only, can run without confirmation when authenticated if required.
- `LOW`: internal state changes such as task or draft request preparation.
- `MEDIUM`: external contact, disabled in V0.4.
- `HIGH`: booking/payment, disabled in V0.4.

V0.4 service flow rules:
- Backend owns provider selection, provider validation, service request state, and task timeline updates.
- Use `POST /tasks/{task_id}/search-services` for task-scoped search.
- Use `POST /tasks/{task_id}/select-provider` to select a factual demo provider and prepare an internal service request.
- Use `POST /service-requests/{id}/confirm` to confirm the internal request. Never rename this to booking until a real integration exists.
- Keep task events factual: `service_options_found`, `provider_selected`, `service_request_prepared`, and `service_request_confirmed` only after those actions happen.
- Never add fake events to make the timeline look complete.

Analytics foundation:
- Use `track_product_event` for sanitized product events.
- Do not store full user prompts, private conversation content, passwords, tokens, API keys, or provider secrets in analytics events.
- Product events should support metrics such as task creation rate, task confirmation rate, service search usage, provider selection rate, service request preparation rate, and task completion rate.

V0.5 readiness notes:
- OpenAI strict structured output uses an explicit schema in `app/ai/provider.py`; do not replace it with raw Pydantic JSON schema unless the live smoke test proves compatibility.
- Live AI smoke tests must stay opt-in with `RUN_LIVE_AI_SMOKE=1` and `AI_API_KEY`. They must not print secrets or persist raw prompts.
- Auth and AI rate limiting should go through `app/core/rate_limit.py`. Redis is preferred; fallback counters are acceptable when Redis is unavailable so local development does not fail closed.
- Web auth remains session-storage based for development, with one refresh-token retry on expired access tokens. Moving to httpOnly cookies requires CSRF and refresh-token flow design across web and mobile; do not do it piecemeal.
- Browser E2E lives in `web/e2e` and runs with `npm run test:e2e`. Playwright starts a deterministic backend on `127.0.0.1:8001` with `AI_MODE=deterministic`, a fresh SQLite database, and seeded demo data, then starts Next.js on `127.0.0.1:3001`.
- Keep E2E assertions focused on user-visible behavior and demo-safety guarantees: no real booking, no provider contact, no prices, and no availability claims.
- Data storage is intentional: messages store conversation content; task data stores user-owned operational context; tool executions store operational inputs/outputs; product analytics store sanitized metadata only.
- Temporary conversation context must not become durable memory unless the user explicitly creates memory.
- Demo seed data may include Tunisian locations such as Ariana, but core backend logic must not assume Tunisia, TND, Tunisian phone formats, or Tunisian cities outside seed/test data.
- Database outage recovery is currently generic. Do not expose SQL errors; the API should return the friendly fallback message.

V0.6 contract notes:
- Shared TypeScript API types live in `packages/contracts/src/index.ts` and are imported by web/mobile as `@nova/contracts`. Keep these contracts aligned with backend Pydantic schemas and endpoint response shapes.
- Backend runtime validation remains Pydantic/FastAPI. Do not move backend business logic or Python validation into the TypeScript contracts package.
- API errors should include `error.code`, `error.message`, and `error.request_id`, while preserving the existing top-level `detail` payload for existing clients.
- Every API response should include `X-Request-ID`. A valid incoming `X-Request-ID` may be reused; otherwise the backend generates one.
- Add contract drift tests when changing task statuses, task event names, provider/service request response shapes, or the API error envelope.

Local setup guardrails:
- Run setup commands from `/home/databiz194/Bureau/formation/NOVA` before entering `backend/`, `web/`, or `mobile/`.
- Docker Compose loads `.env`, not `.env.example`. Create it with `cp .env.example .env` and change JWT secrets before sharing or deploying.
- Ubuntu/Debian Python is externally managed. Use `python3 -m venv .venv`, `source .venv/bin/activate`, then `python -m pip install -e ".[dev]"`. Do not use `--break-system-packages` for normal development.
- For Expo on physical devices or Android emulators, set `EXPO_PUBLIC_API_URL` to a reachable host URL; `localhost` usually points to the device, not the workstation.
