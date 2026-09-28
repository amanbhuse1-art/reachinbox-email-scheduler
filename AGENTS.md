# ReachInbox Email Scheduler - Development Rules

## Project

Build the ReachInbox Full-stack Email Job Scheduler assignment.

Required backend:
- TypeScript
- Node.js
- Express.js
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Nodemailer
- Ethereal SMTP
- Elasticsearch
- Bull Board
- Google OAuth 2.0
- Slack OAuth 2.0
- Zod
- Pino

Required frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Sonner

Infrastructure:
- Docker Compose

## Critical Rules

NEVER use:
- cron
- node-cron
- agenda
- OS crontab
- setInterval as the application scheduler

Scheduling must use BullMQ delayed jobs and Redis-backed scheduling logic.

PostgreSQL is the source of truth for business state.

Redis is used for:
- BullMQ
- distributed rate limiting
- sender slot allocation
- sessions
- OAuth state
- locks where necessary

Elasticsearch is a searchable projection and is not the source of truth.

## Email Requirements

Support:
- multiple senders
- configurable worker concurrency
- configurable minimum delay between sends
- configurable hourly sender rate limit
- safe operation across multiple workers
- persistent scheduled jobs
- restart recovery
- idempotency
- duplicate-send protection

Never use in-memory counters for distributed rate limiting.

Use Redis atomic operations or Lua scripts.

Jobs must never be permanently dropped because of a rate limit.

They must be moved to future available time windows.

## Authentication

Google OAuth must be real.

Slack OAuth must be real.

Do not replace required OAuth flows with mocks.

Use secure HTTP-only session cookies.

## Slack

When the sender hourly rate limit is reached:
- send a real Slack notification
- notify only once per sender per hourly window

If Slack is disconnected:
- do not crash
- skip notification

Slack errors must never cause email sending to fail.

## Elasticsearch

Index:
- recipient
- subject
- sender
- campaign
- status
- scheduledAt
- sentAt

Search must enforce tenant isolation.

## Queue

Use BullMQ.

Job payloads should contain IDs rather than large data.

Example:

{
  "emailMessageId": "uuid"
}

Do not put SMTP passwords or OAuth secrets in Redis jobs.

## Database

Use Prisma.

Use transactions.

Use appropriate:
- foreign keys
- indexes
- unique constraints
- enums

## Security

Use:
- Helmet
- strict CORS
- secure cookies
- OAuth state validation
- Zod validation
- upload size limits
- API rate limiting
- encrypted secrets
- authenticated routes

Never log:
- passwords
- OAuth secrets
- Slack tokens
- SMTP passwords
- session secrets
- email bodies

## Frontend

Use reusable components.

Implement:
- loading states
- empty states
- error states
- success/error toasts
- pagination
- search
- responsive layout

Match the supplied Figma closely.

## Coding Rules

Before changing code:
1. inspect the existing repository
2. understand the current architecture
3. preserve existing working functionality

When creating or modifying files:
- use complete runnable code
- use proper TypeScript
- do not use placeholder implementations
- do not leave TODOs for required features
- keep controllers thin
- put business logic in services
- validate external inputs

After every implementation phase:
1. run type checking
2. run lint
3. run tests
4. fix errors
5. explain what changed

Do not automatically continue to the next phase.

## Development Order

Phase 1 - Monorepo
Phase 2 - Docker infrastructure
Phase 3 - PostgreSQL + Prisma
Phase 4 - Google OAuth
Phase 5 - CSV + scheduling API
Phase 6 - BullMQ + worker + Ethereal
Phase 7 - restart recovery + idempotency
Phase 8 - distributed rate limiting
Phase 9 - Slack OAuth + notifications
Phase 10 - Elasticsearch
Phase 11 - Bull Board
Phase 12 - React dashboard
Phase 13 - testing
Phase 14 - load testing
Phase 15 - Figma polish
Phase 16 - README + demo

Do not use cron anywhere in the project.

Do not declare the project complete until the required features have actually been tested.