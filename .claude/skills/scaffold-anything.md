# scaffold-anything

Scaffold a new project from scratch with à la carte layers. Reads personal config, gathers inputs interactively, creates the GitHub repo, clones it locally, generates all project files, and outputs nginx + PM2 config for the server.

---

## 1. Load config

Read `D:\workspace-ns.s\ns.s-scaffold-anything\.env` (this project's root — not the home dir). Parse as KEY=VALUE pairs, ignoring blank lines and comments.

If the file doesn't exist: tell the user to create it using `.env.example` from the same repo. Stop.

---

## 2. Gather inputs

Ask each question in sequence. Do not proceed until each is answered.

**Repo name**
- Must be lowercase, hyphens only, no spaces
- Remind the user of any org naming convention visible from their existing repos (e.g. `ns.s-` prefix for noshit-software, `knightsrook-` prefix for robertgardunia)

**Org**
- Show a numbered menu from `SCAFFOLD_GITHUB_ORGS` (comma-separated)
- User picks a number

**Description**
- One-line repo description

**Subdomain**
- Suggest `{repo-name}.{SCAFFOLD_CF_DOMAIN_{org}}` as the default
- User can accept or enter a different subdomain
- Type `none` to skip DNS creation

**Project type**
```
[1] Single app   — one frontend/backend/db, deployed as a unit
[2] Multi-service — docker-compose with separate backend, dashboard, and db containers
```

---

### If Single app — layer menus

Present each as a numbered menu, user picks one per category:

```
Frontend:  [1] React+Vite  [2] BabylonJS+Vite  [3] Three.js+Vite  [4] Next.js  [5] none
Backend:   [1] Express     [2] FastAPI          [3] none
Database:  [1] MySQL       [2] Postgres         [3] none
Auth:      [1] Clerk       [2] Passport/JWT     [3] none
Deploy:    [1] PM2         [2] Docker           [3] none
```

---

### If Multi-service — service menus

```
Backend:   [1] FastAPI (Python 3.12 + uv)  [2] Express (Node/TS)  [3] none
Dashboard: [1] React+Vite (internal tool)  [2] none
Database:  [1] Postgres (pgvector + AGE)   [2] MySQL               [3] none
Auth:      [1] API Key (header/query)      [2] none
Docs:      [1] docs/architecture/ stub     [2] none
```

Multi-service always uses Docker Compose for deploy. PM2 is not offered.

---

**Confirm**
Show a summary of all selections and ask to proceed (y/n).

---

## 3. Assign port

Based on backend layer, assign the next available port from the appropriate range in config:
- Express → `SCAFFOLD_PORT_RANGE_EXPRESS`
- FastAPI → `SCAFFOLD_PORT_RANGE_FASTAPI`
- Next.js (no separate backend) → `SCAFFOLD_PORT_RANGE_NEXTJS`
- Vite dev server (single-app frontend only) → `SCAFFOLD_PORT_RANGE_VITE_DEV`
- Multi-service dashboard → `SCAFFOLD_PORT_RANGE_VITE_DEV` (dashboard exposed port)
- none → no port needed

Use the start of the range as the default. Tell the user which port was assigned and ask them to confirm it's free.

---

## 4. Create and clone repo

```bash
gh repo create {org}/{repo-name} --public --description "{description}"
```

Derive the local workspace path from config:
- Key: `SCAFFOLD_WORKSPACE_{ORG}` where hyphens in the org name are replaced with underscores
- Clone into `{workspace}/{repo-name}`

```bash
gh repo clone {org}/{repo-name} {workspace}/{repo-name}
```

---

## 5. Scaffold project files

Create files based on selected layers. Enforce these conventions across all projects:

### Universal files (always created)
- `.env.example` — all env vars the project needs, blank values
- `.gitignore` — appropriate for the stack
- `README.md` — repo name, description, stack, quickstart

### Conventions to enforce in every project
- Single start command: `pnpm dev` (single-app) or `docker compose up --build` (multi-service) boots everything
- Env validated on startup — fail fast with a clear message if required vars are missing
- Standard API response shape for any backend: `{ success: bool, data: any, error?: string }`
- All secrets in `.env`, never hardcoded

---

## Single-app layer specs

### Layer: React+Vite

```
src/
  main.tsx
  App.tsx
  components/
  assets/
vite.config.ts
tsconfig.json
package.json  (scripts: dev, build, preview)
```

### Layer: BabylonJS+Vite

```
src/
  main.ts
  scene.ts
  assets/
public/
vite.config.ts
tsconfig.json
package.json  (scripts: dev, build)
```
- Import BabylonJS as ES modules (`@babylonjs/core`)
- Scene initialized in `scene.ts`, mounted in `main.ts`

### Layer: Three.js+Vite

```
src/
  main.ts
  scene.ts
  assets/
public/
vite.config.ts
tsconfig.json
package.json  (scripts: dev, build)
```

### Layer: Next.js

```
src/
  app/
    layout.tsx
    page.tsx
  components/
  lib/
next.config.ts
tsconfig.json
package.json  (scripts: dev, build, start)
```
- Use App Router
- If Auth=Clerk: install `@clerk/nextjs`, wrap layout with `<ClerkProvider>`, add middleware
- If DB=MySQL: add `src/lib/db.ts` with mysql2 pool + env validation
- If DB=Postgres: add `src/lib/db.ts` with postgres pool + env validation

### Layer: Express

```
src/
  index.ts       — app entry, env validation, server listen
  app.ts         — express setup, middleware, route registration
  routes/
    index.ts
  middleware/
    errorHandler.ts
    auth.ts        (stub — only if Auth layer selected)
  lib/
    db.ts          (only if DB selected)
  __tests__/
    health.test.ts — smoke test: GET /health returns 200
scripts/
  db-reset.ts    — stub (only if DB selected): drops runtime schema, recreates it
  db-seed.ts     — stub (only if DB selected): inserts baseline rows
tsconfig.json
package.json  (scripts: dev [tsx watch], build [tsc], start, test [vitest run], test:watch [vitest], db:reset, db:seed)
```
- Middleware order: helmet → morgan → cors → json → routes → errorHandler
- DB module exports a pool, validates DB env vars on import
- Test runner: vitest, default-on — `pnpm test` runs once, `pnpm test:watch` watches
- `db:reset` and `db:seed` npm script slots are always generated when DB is selected; stubs print a TODO and exit 0

### Layer: FastAPI (single-app)

```
app/
  main.py       — FastAPI app, CORS, router registration
  routes/
    __init__.py
  lib/
    db.py         (only if DB selected)
pyproject.toml  (uv managed)
.python-version
```
- Use `uv` as package manager
- Startup: `uvicorn app.main:app --port {port}`
- If frontend layer also selected: root `package.json` with `concurrently` to run both

### Layer: MySQL

- Add `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT` to `.env.example`
- Add `src/lib/db.ts` (Express) or `app/lib/db.py` (FastAPI) with connection pool + env validation
- Add `schema.sql` at repo root with `CREATE DATABASE IF NOT EXISTS` + initial tables stub

### Layer: Postgres (single-app)

- Add `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASS`, `POSTGRES_DB` to `.env.example`
- Add `src/lib/db.ts` (Express) with `pg` Pool + env validation + per-connection AGE bootstrap
- Add `db/init/` with extension + graph init scripts
- Add `db/Dockerfile` building pgvector + AGE in one image
- Add `schema.sql` with substrate/runtime schema separation

**`src/lib/db.ts`** — the `pool.on('connect')` hook is non-optional; without it every Cypher query fails with a cryptic error:

```ts
import pg from 'pg'

const required = ['POSTGRES_HOST','POSTGRES_USER','POSTGRES_PASS','POSTGRES_DB','POSTGRES_PORT']
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}

export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASS,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
})

pool.on('connect', async (client) => {
  await client.query(`LOAD 'age'`)
  await client.query(`SET search_path = ag_catalog, "$user", public`)
})
```

**`db/init/01-extensions.sql`** — runs at container init, installs both extensions and creates the default graph:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
LOAD 'age';
CREATE EXTENSION IF NOT EXISTS age;
SET search_path = ag_catalog, "$user", public;
SELECT * FROM ag_catalog.create_graph('graph');
```

**`db/Dockerfile`** — stock postgres has neither extension; pgvector image has only one; this compiles AGE onto the pgvector base:

```dockerfile
FROM pgvector/pgvector:pg16

RUN apt-get update && apt-get install -y \
    build-essential postgresql-server-dev-16 git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch PG16 https://github.com/apache/age.git /tmp/age \
    && cd /tmp/age \
    && make PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
    && make install PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
    && rm -rf /tmp/age
```

**Schema convention** — `schema.sql` defines two schemas:
- `substrate` — persistent reference data; survives `db:reset`
- `runtime` — ephemeral working state; dropped and recreated by `db:reset`

`db:reset` drops only `runtime`. `db:seed` repopulates it. The wipe boundary is structural (schema name), not encoded in application logic.

### Layer: Clerk (Auth)

- Add `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to `.env.example`
- For Next.js: install `@clerk/nextjs`, add middleware.ts, wrap layout

### Layer: Passport/JWT (Auth)

- Add `JWT_SECRET` to `.env.example`
- Add `src/middleware/auth.ts` with JWT verify middleware stub
- Add `src/routes/auth.ts` with login/logout/register stubs

### Layer: PM2 (Deploy)

Generate `ecosystem.config.js` at repo root:

```js
module.exports = {
  apps: [{
    name: '{repo-name}',
    script: '{SCAFFOLD_SERVER_APPS_DIR}/{repo-name}/dist/index.js',
    cwd: '{SCAFFOLD_SERVER_APPS_DIR}/{repo-name}',
    env: { NODE_ENV: 'production', PORT: {assigned-port} }
  }]
}
```

Also print nginx server block snippet for the user to paste:

```nginx
server {
    listen 80;
    server_name {subdomain};

    location / {
        proxy_pass http://localhost:{assigned-port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Layer: Docker (single-app deploy)

Generate `Dockerfile` and `docker-compose.yml` appropriate for the backend layer.

---

## Multi-service layer specs

Multi-service projects use this directory structure:

```
{repo-name}/
├── backend/
├── dashboard/         (if Dashboard selected)
├── db/
│   └── init/
├── docs/
│   └── architecture/  (if Docs selected)
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

### Multi-service: Backend = FastAPI

Full production-ready FastAPI skeleton with structured logging, event bus, and dashboard stream:

```
backend/
  app/
    main.py             — FastAPI entry, lifespan, CORS, router registration
    config.py           — Pydantic Settings, validates all env on startup, fails fast
    db.py               — asyncpg pool; enables pgvector + sets AGE search_path on connect
    logging.py          — structlog configuration (JSON in prod, console in dev)
    events.py           — internal async pub-sub event bus
    dashboard_stream.py — WebSocket endpoint at /ws/events; broadcasts events to dashboard
    api/
      __init__.py
      health.py         — GET /health → { status, db, uptime }
      topics.py         — basic CRUD stub
    subsystems/
      __init__.py       — empty; sovereign components live here
  pyproject.toml        — uv project: fastapi, uvicorn, asyncpg, structlog, pydantic-settings, pytest-asyncio
  .python-version       — 3.12
  Dockerfile
  ruff.toml             — ruff lint + format config
```

**`app/main.py`** — lifespan initializes DB pool and event bus; registers all routers; mounts dashboard stream WebSocket.

**`app/config.py`** — uses `pydantic-settings`; all fields required with no defaults (missing vars crash at startup with a clear message).

**`app/db.py`** — on pool creation, runs `CREATE EXTENSION IF NOT EXISTS vector` and `LOAD 'age'` + sets `search_path = ag_catalog, public`.

**`app/events.py`** — asyncio-based pub-sub: `publish(event_type, payload)`, `subscribe(event_type)` returns an async generator. Subsystems emit observable events without coupling.

**`app/dashboard_stream.py`** — WebSocket endpoint `/ws/events`; subscribes to all event types; pushes JSON to connected dashboard clients. Handles disconnect gracefully.

**`backend/Dockerfile`**:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml .
RUN uv sync --no-dev
COPY app/ ./app/
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Multi-service: Backend = Express

```
backend/
  src/
    index.ts
    app.ts
    routes/
      index.ts
      health.ts
    middleware/
      errorHandler.ts
      auth.ts            (if Auth=API Key)
    lib/
      db.ts              (if DB selected)
  tsconfig.json
  package.json
  Dockerfile
```

### Multi-service: Dashboard = React+Vite (internal tool)

Three-panel layout: event stream, state inspector, manual probe. Connects to backend via WebSocket.

```
dashboard/
  src/
    main.tsx
    App.tsx
    panels/
      EventStream.tsx    — live WebSocket feed, auto-scrolling log
      StateInspector.tsx — table view of current topics/memory state; polls /api/topics
      ManualProbe.tsx    — form to trigger retrievals; displays result JSON
    lib/
      ws.ts              — useWebSocket hook; auto-reconnect with backoff
      api.ts             — typed fetch wrappers for backend REST endpoints
    components/
      Panel.tsx          — shared panel chrome (title, collapse, resize handle)
  vite.config.ts         — proxy /api and /ws to backend in dev
  tsconfig.json
  package.json           (scripts: dev, build, preview)
  Dockerfile             — nginx:alpine serving built dist/
```

**`vite.config.ts`** — proxy `/api` → `http://backend:8000` and `/ws` → `ws://backend:8000` so dashboard dev server talks to the backend without CORS.

**`dashboard/Dockerfile`**:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`dashboard/nginx.conf`** — serves static files, proxies `/api` and `/ws` to backend container.

### Multi-service: Database = Postgres (pgvector + AGE)

```
db/
  init/
    01-extensions.sql   — installs pgvector and AGE
    02-schema.sql       — base schema stub
  Dockerfile            — pgvector:pg16 base + AGE compiled from source
```

**`db/Dockerfile`**:
```dockerfile
FROM pgvector/pgvector:pg16

RUN apt-get update && apt-get install -y \
    build-essential postgresql-server-dev-16 git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch PG16 https://github.com/apache/age.git /tmp/age \
    && cd /tmp/age \
    && make PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
    && make install PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config \
    && rm -rf /tmp/age
```

**`db/init/01-extensions.sql`** — runs at container init, installs both extensions and creates the default graph:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
LOAD 'age';
CREATE EXTENSION IF NOT EXISTS age;
SET search_path = ag_catalog, "$user", public;
SELECT * FROM ag_catalog.create_graph('graph');
```

**`db/init/02-schema.sql`** — project-specific stub with a comment block explaining the schema.

**Per-connection AGE bootstrap** — every connection that touches AGE needs `LOAD 'age'` before Cypher works. For FastAPI/asyncpg, wire it via the `init` parameter:

```python
async def _init_conn(conn):
    await conn.execute("LOAD 'age'")
    await conn.execute("SET search_path = ag_catalog, \"$user\", public")

pool = await asyncpg.create_pool(..., init=_init_conn)
```

For Express/pg, use `pool.on('connect')` — see single-app Postgres spec.

Postgres env vars added to `.env.example`:
```
POSTGRES_USER=
POSTGRES_PASS=
POSTGRES_DB=
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

### Multi-service: Database = MySQL (in compose)

Same as single-app MySQL but wired into docker-compose as a service using `mysql:8` image, with `db/init/01-schema.sql` mounted.

### Multi-service: Auth = API Key

- Add `API_KEY` to `.env.example`
- Add `app/middleware/auth.py` (FastAPI) or `src/middleware/auth.ts` (Express): check `Authorization: Bearer <key>` header or `?api_key=<key>` query param; return 401 if invalid
- Skip check when `API_KEY` is empty (dev convenience)

### Multi-service: Docker Compose

Generate `docker-compose.yml` wiring all selected services:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "${BACKEND_PORT}:8000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    networks: [app-net]
    restart: unless-stopped

  dashboard:
    build: ./dashboard
    ports:
      - "${DASHBOARD_PORT}:80"
    depends_on:
      - backend
    networks: [app-net]
    restart: unless-stopped

  db:
    build: ./db
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASS}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks: [app-net]
    restart: unless-stopped

volumes:
  pg_data:

networks:
  app-net:
    driver: bridge
```

Omit services that weren't selected. If DB=MySQL, use `mysql:8` image instead and adjust healthcheck to `mysqladmin ping`.

### Multi-service: Docs = docs/architecture/

```
docs/
  architecture/
    overview.md    — template with sections: Purpose, Services, Data Model, Key Flows, ADRs
```

**`docs/architecture/overview.md`** template:
```markdown
# {repo-name} — Architecture Overview

## Purpose

{one-paragraph description}

## Services

| Service | Tech | Port | Responsibility |
|---------|------|------|----------------|
| backend | FastAPI | 8000 | ... |
| dashboard | React+Vite | {dashboard-port} | ... |
| db | Postgres 16 | 5432 | ... |

## Data Model

_Describe key tables/graphs here._

## Key Flows

_Numbered sequence descriptions of the most important request paths._

## Architecture Decision Records

### ADR-001 — {title}
**Status:** Accepted
**Context:** ...
**Decision:** ...
**Consequences:** ...
```

This file is checked into the repo so CC has architecture context available when working inside the codebase without needing MCP lookup.

---

## 6. Create Cloudflare DNS record

Skip this step if:
- User typed `none` for subdomain, OR
- `SCAFFOLD_CF_ZONE_ID_{org}` is empty in config (Cloudflare not yet configured for that org)

Look up `SCAFFOLD_CF_ZONE_ID_{org}` and `SCAFFOLD_CF_DOMAIN_{org}` (hyphens in org → underscores).

Make a POST to the Cloudflare API to create an A record:
- Subdomain: `{chosen-subdomain}` (just the label, not the full domain)
- Points to: `{SCAFFOLD_SERVER_HOST}`
- Proxied: true

```
POST https://api.cloudflare.com/client/v4/zones/{SCAFFOLD_CF_ZONE_ID_{org}}/dns_records
Authorization: Bearer {SCAFFOLD_CF_API_TOKEN}
{
  "type": "A",
  "name": "{chosen-subdomain}",
  "content": "{SCAFFOLD_SERVER_HOST}",
  "proxied": true
}
```

---

## 7. Initial commit and push

```bash
cd {workspace}/{repo-name}
git add .
git commit -m "Initial scaffold: {layers summary}"
git push origin main
```

---

## 8. Done — print summary

### Single app

```
✓ Repo:      https://github.com/{org}/{repo-name}
✓ Local:     {workspace}/{repo-name}
✓ DNS:       {subdomain} → {SCAFFOLD_SERVER_HOST}   (or: skipped)
✓ Port:      {assigned-port}

Next steps:
  1. cp .env.example .env && fill in values
  2. pnpm install && pnpm dev
  3. On server: paste nginx config → {SCAFFOLD_SERVER_NGINX_SITES}/{repo-name}
               sudo nginx -t && sudo systemctl reload nginx
               pm2 start ecosystem.config.js && pm2 save
```

### Multi-service

```
✓ Repo:      https://github.com/{org}/{repo-name}
✓ Local:     {workspace}/{repo-name}
✓ DNS:       {subdomain} → {SCAFFOLD_SERVER_HOST}   (or: skipped)
✓ Backend:   :{backend-port}
✓ Dashboard: :{dashboard-port}

Next steps:
  1. cp .env.example .env && fill in values
  2. docker compose up --build
  3. Dashboard: http://localhost:{dashboard-port}
  4. API:       http://localhost:{backend-port}/health
  5. DB build note: first build compiles AGE from source — takes ~3 min
```
