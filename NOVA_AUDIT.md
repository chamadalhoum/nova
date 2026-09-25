# NOVA Audit

## Current State

Repository path: `/home/databiz194/Bureau/formation/NOVA`

Git state checked on 2026-09-11:

- Current branch: `master`
- Commit history: no commits yet
- Working tree before documentation: clean
- Project files: none found outside `.git/`

This is an empty Git repository. There is no existing application architecture, source code, database schema, API, frontend, mobile app, Docker setup, test suite, README, or environment file to preserve.

## Stack Detection

No stack is currently implemented.

Recommended target stack for NOVA:

- Backend: Python 3.13+, FastAPI, Pydantic, SQLAlchemy, Alembic, PostgreSQL, Redis
- Web: Next.js, TypeScript, React, Tailwind CSS, TanStack Query
- Mobile: React Native, Expo, TypeScript, Expo Router, TanStack Query
- Infrastructure: Docker Compose for local development
- Quality: pytest, Ruff, mypy where useful, frontend type checks and tests

## Existing Assets

Reusable code: none.

Existing documentation: none.

Existing tests: none.

Existing CI/CD: none.

Existing database: none.

Existing Docker: none.

## Technical Debt

No inherited technical debt exists because the repository is empty.

Early risk is not legacy complexity. The risk is overbuilding too early.

## Dangerous Areas

The main dangerous areas for the first implementation phase are:

- Creating too many tables before validating MVP flows
- Duplicating business logic between web and mobile
- Coupling AI logic directly to one provider
- Treating AI output as trusted input
- Building marketplace/payment/travel/shopping complexity before core task completion works
- Hardcoding Tunisia-specific locale, currency, phone, city, or provider assumptions
- Storing user memory without explicit minimization and control

## Repository Recommendation

Use a monorepo with separate apps and shared contracts:

```text
backend/
web/
mobile/
packages/
  contracts/
  config/
docs/
```

Keep the backend as the source of truth for business logic, AI orchestration, task state, memory, permissions, and provider/tool execution.

## Audit Conclusion

The repository is ready for greenfield planning. No code should be built until the MVP plan is accepted. The first implementation should create only the minimal foundation needed for authentication, conversations, AI intent handling, task creation, controlled memory, reminders, and basic provider discovery.
