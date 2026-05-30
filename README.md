# scaffold-anything

A Claude Code skill that scaffolds new projects from scratch with à la carte layers.

## What it does

Invoke `/scaffold-anything` in Claude Code and it will:

1. Ask for a repo name, org, description, subdomain, and project type
2. Let you pick layers (or services for multi-service projects)
3. Create the GitHub repo and clone it locally
4. Scaffold all project files with consistent structure and conventions enforced
5. Create a Cloudflare DNS subdomain (if zone ID is configured for the org)
6. Output nginx + PM2 config (single-app) or docker compose up instructions (multi-service)

## Setup

**1. Install the skill**

Copy `.claude/skills/scaffold-anything.md` to your global Claude skills directory:

```bash
cp .claude/skills/scaffold-anything.md ~/.claude/skills/scaffold-anything.md
```

Or on Windows, into `C:\Users\{you}\.claude\skills\scaffold-anything\SKILL.md`.

**2. Create your config**

Copy `.env.example` to `.env` in this project's root and fill in your values.
The skill reads config from `D:\workspace-ns.s\ns.s-scaffold-anything\.env`.

**3. Validate your config**

```bash
npm run validate
```

## Project types

### Single app
One frontend/backend/db, deployed as a unit via PM2 or Docker.

| Category | Options |
|----------|---------|
| Frontend | React+Vite, BabylonJS+Vite, Three.js+Vite, Next.js, none |
| Backend  | Express, FastAPI, none |
| Database | MySQL, Postgres (pgvector + AGE), none |
| Auth     | Clerk, Passport/JWT, none |
| Deploy   | PM2, Docker, none |

### Multi-service
Separate backend, dashboard, and db containers wired via docker-compose. Always produces a `docker-compose.yml`.

| Category  | Options |
|-----------|---------|
| Backend   | FastAPI (Python 3.12 + uv + structlog + ruff), Express, none |
| Dashboard | React+Vite internal tool (WebSocket event stream, state inspector, manual probe), none |
| Database  | Postgres (pgvector + AGE, custom Dockerfile), MySQL, none |
| Auth      | API Key (header or query param), none |
| Docs      | docs/architecture/ stub (overview.md template for CC context), none |

#### FastAPI multi-service skeleton
Scaffolds a full async FastAPI service including:
- `app/config.py` — Pydantic Settings, fails fast on missing env vars
- `app/db.py` — asyncpg pool with pgvector and AGE setup
- `app/logging.py` — structlog (JSON in prod, console in dev)
- `app/events.py` — internal async pub-sub event bus
- `app/dashboard_stream.py` — WebSocket `/ws/events` for dashboard observability
- `app/api/` — health check + topics CRUD stub
- `app/subsystems/` — empty; sovereign components go here

#### Postgres with pgvector + AGE
Builds a custom Docker image from `pgvector/pgvector:pg16` that compiles Apache AGE from source. Init scripts enable both extensions on first run. Note: first build takes ~3 minutes.
