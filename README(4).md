# ReachInbox Email Scheduler

A full-stack email scheduling platform built for the ReachInbox hiring assignment.

The project uses TypeScript, Express, React, PostgreSQL, Prisma, Redis, BullMQ, and Ethereal SMTP. It is structured as a monorepo with a web application, API, and background worker.

## Features

- Google OAuth 2.0 authentication
- Session-based authentication
- Multi-tenant workspace model
- PostgreSQL database with Prisma ORM
- Redis for sessions and BullMQ
- BullMQ-based background email processing
- Dedicated email worker
- Ethereal SMTP email delivery
- Sender account management
- Campaign creation and scheduling
- Configurable worker concurrency
- Configurable sender minimum delay and hourly limits
- Persistent campaign and email records
- TypeScript across the application
- Docker-based local infrastructure
- Elasticsearch integration architecture
- Slack integration architecture
- Idempotency and restart-safe job design

## Architecture

```text
                         +----------------------+
                         |    React / Vite      |
                         |    Web Application   |
                         |      :5173           |
                         +----------+-----------+
                                    |
                                    | HTTP + Session
                                    v
                         +----------------------+
                         |    Express API       |
                         |      :4000           |
                         +----+-----+-----+-----+
                              |     |     |
                    +---------+     |     +----------------+
                    |               |                      |
                    v               v                      v
             +-------------+  +-----------+       +----------------+
             | PostgreSQL  |  |   Redis   |       | Elasticsearch  |
             | Source of   |  | BullMQ +  |       | Search /       |
             | Truth       |  | Sessions  |       | Projection     |
             +-------------+  +-----+-----+       +----------------+
                                    |
                                    v
                           +------------------+
                           |  BullMQ Worker   |
                           | Email Processing |
                           +--------+---------+
                                    |
                                    v
                           +------------------+
                           |  Ethereal SMTP   |
                           +------------------+
```

PostgreSQL is the durable source of truth. Redis/BullMQ is used for asynchronous job processing and coordination.

## Project Structure

```text
reachinbox-email-scheduler/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── generated/
│   │       ├── lib/
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── server.ts
│   │
│   ├── worker/
│   │   └── src/
│   │       ├── lib/
│   │       └── worker.ts
│   │
│   └── web/
│       └── src/
│
├── packages/
│   └── shared/
├── infra/
├── docs/
├── prisma.config.ts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
├── .gitignore
└── README.md
```

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express
- TypeScript
- Prisma

### Data and Infrastructure

- PostgreSQL
- Redis
- BullMQ
- Elasticsearch
- Docker / Docker Compose

### Email and Authentication

- Nodemailer
- Ethereal SMTP
- Google OAuth 2.0
- Express Session

## Prerequisites

- Node.js 22+
- pnpm 12+
- Docker Desktop
- Git

Verify the installation:

```bash
node --version
pnpm --version
docker --version
git --version
```

## Installation

Clone the repository:

```bash
git clone <YOUR_PRIVATE_REPOSITORY_URL>
cd reachinbox-email-scheduler
```

Install dependencies:

```bash
pnpm install
```

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL="postgresql://reachinbox:reachinbox@127.0.0.1:5433/reachinbox"

REDIS_URL="redis://127.0.0.1:6379"

ELASTICSEARCH_URL="http://127.0.0.1:9200"

GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"

FRONTEND_URL="http://localhost:5173"

SESSION_SECRET="your_session_secret"

ETHEREAL_SMTP_HOST="smtp.ethereal.email"
ETHEREAL_SMTP_PORT="587"
ETHEREAL_SMTP_USER="your_ethereal_username"
ETHEREAL_SMTP_PASSWORD="your_ethereal_password"

WORKER_CONCURRENCY="5"

SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"
SLACK_REDIRECT_URI="http://localhost:4000/auth/slack/callback"
```

**Never commit `.env` or credentials to GitHub.**

## Start Infrastructure

Start PostgreSQL, Redis, and Elasticsearch:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Check running containers:

```bash
docker ps
```

Stop infrastructure:

```bash
docker compose -f infra/docker-compose.yml down
```

## Database Setup

Run migrations:

```bash
pnpm exec prisma migrate deploy
```

Generate Prisma Client:

```bash
pnpm exec prisma generate
```

Seed the development database:

```bash
pnpm --filter @reachinbox/api exec tsx prisma/seed.ts
```

## Run the Application

### API

Open a terminal:

```bash
pnpm --filter @reachinbox/api dev
```

API:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

### Worker

Open a second terminal:

```bash
pnpm --filter @reachinbox/worker dev
```

The worker consumes jobs from the `email-sending` BullMQ queue.

### Web

Open a third terminal:

```bash
pnpm --filter @reachinbox/web dev
```

Frontend:

```text
http://localhost:5173
```

## Google OAuth Configuration

Create a Google OAuth 2.0 Web Application and configure:

### Authorized JavaScript Origin

```text
http://localhost:5173
```

### Authorized Redirect URI

```text
http://localhost:4000/auth/google/callback
```

For an OAuth application in testing mode, add the required test users.

## Email Scheduling Flow

```text
User
  |
  | Create Campaign
  v
Express API
  |
  +-- Validate authenticated tenant
  +-- Validate sender
  +-- Create Campaign
  +-- Create EmailMessage records
  +-- Add delayed BullMQ jobs
  |
  v
Redis / BullMQ
  |
  v
Email Worker
  |
  +-- Process scheduled job
  +-- Send using SMTP
  +-- Record delivery result
  |
  v
Ethereal SMTP
```

Each recipient is represented by an individual `EmailMessage` record. The database record is persistent even when the worker process is restarted.

## Queue Design

The project uses BullMQ delayed jobs rather than cron-based scheduling.

Example queue:

```text
email-sending
```

Worker concurrency is configurable using:

```env
WORKER_CONCURRENCY=5
```

The worker loads email information and sends through the configured SMTP provider.

## Sender Configuration

Sender accounts support configuration for:

- Sender email address
- SMTP host
- SMTP port
- SMTP credentials
- Minimum delay between messages
- Maximum emails per hour
- Enabled/disabled state

The API scopes sender records to the authenticated tenant.

## Idempotency and Persistence

Each scheduled email has a persistent database record and a unique idempotency key.

BullMQ jobs are associated with the corresponding email record.

This provides the foundation for:

- preventing duplicate scheduling
- retry-safe processing
- restart-safe job handling
- persistent campaign state

## Database Model

The main entities are:

```text
User
 |
 +-- Tenant
      |
      +-- SenderAccount
      |
      +-- Campaign
      |     |
      |     +-- EmailMessage
      |
      +-- SlackConnection
      |
      +-- IdempotencyKey
      |
      +-- OutboxEvent
```

### User

Stores Google-authenticated users.

### Tenant

Represents an isolated workspace.

### SenderAccount

Stores sender configuration and sending constraints.

### Campaign

Stores subject, body, sender, start time, delay, hourly limit, and campaign status.

### EmailMessage

Stores recipient, scheduled time, status, attempts, errors, and provider message ID.

### SlackConnection

Stores tenant Slack integration information.

### IdempotencyKey

Provides duplicate-request protection for campaign creation.

### OutboxEvent

Provides a durable event mechanism for asynchronous processing.

## API Endpoints

### Authentication

```text
GET  /auth/me
GET  /auth/google
GET  /auth/google/callback
POST /auth/logout
```

### Campaigns

```text
GET  /campaigns
POST /campaigns
```

### Senders

```text
GET /senders
```

### Health

```text
GET /health
```

## Verification

Typecheck all workspaces:

```bash
pnpm typecheck
```

Build all workspaces:

```bash
pnpm build
```

Lint:

```bash
pnpm lint
```

Check formatting:

```bash
pnpm format:check
```

API health check:

```bash
curl http://localhost:4000/health
```

Redis check:

```bash
docker exec -it reachinbox-redis redis-cli ping
```

Expected:

```text
PONG
```

## Docker Commands

Start:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Stop:

```bash
docker compose -f infra/docker-compose.yml down
```

View logs:

```bash
docker compose -f infra/docker-compose.yml logs
```

View running containers:

```bash
docker ps
```

## Security

- Secrets are stored in environment variables.
- `.env` is excluded from Git.
- Google OAuth credentials remain server-side.
- Sessions are server-managed.
- Tenant-scoped queries protect workspace data.
- SMTP credentials are not exposed to the frontend.
- Sensitive credentials should not be placed in BullMQ job payloads.

## Design Decisions

### PostgreSQL as source of truth

PostgreSQL stores durable application state. Redis is not used as the primary database.

### BullMQ instead of cron

Scheduling is implemented with BullMQ delayed jobs. This allows jobs to remain in the queue and be processed by dedicated workers.

### Dedicated worker

Email sending is separated from the API process so background work does not block HTTP requests.

### Redis

Redis provides the queue backend and shared session/coordination infrastructure.

### Multi-tenant architecture

Users belong to tenants/workspaces, and application resources are scoped by tenant ID.

## Planned / Assignment Components

The project architecture includes the remaining assignment components as they are completed:

- Elasticsearch search projection
- Slack OAuth and rate-limit notifications
- Protected Bull Board monitoring
- Full dashboard views for Scheduled and Sent emails
- CSV recipient upload
- Production deployment configuration

## Production Checklist

Before production deployment:

- Use HTTPS.
- Use production PostgreSQL and Redis.
- Store secrets in a secure secret manager.
- Configure secure session cookies.
- Restrict CORS to the production frontend.
- Configure production Google OAuth redirect URLs.
- Configure Slack OAuth redirect URLs.
- Secure Elasticsearch with authentication/TLS.
- Protect Bull Board and administrative endpoints.
- Configure database backups.
- Add structured logging and monitoring.

## Assignment Submission

This repository was created for the ReachInbox hiring assignment.

The final submission should include:

- Private GitHub repository
- Hosted application URL
- Demo video
- Setup and architecture documentation
- Working API, worker, and frontend
- Required OAuth, queue, database, and email functionality

## Author

**Aman Bhuse**

B.Tech Information Technology / Data Science

GitHub: https://github.com/amanbhuse1-art

## License

This repository was created for the ReachInbox hiring assignment and is intended for evaluation purposes.
