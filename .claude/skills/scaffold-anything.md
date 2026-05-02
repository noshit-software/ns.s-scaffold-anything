# scaffold-anything

Scaffold a new project from scratch with à la carte layers. Reads personal config, gathers inputs interactively, creates the GitHub repo, clones it locally, generates all project files, and outputs nginx + PM2 config for the server.

---

## 1. Load config

Read `~/.scaffold-anything/.env` (Linux/Mac) or `C:/Users/{username}/.scaffold-anything/.env` (Windows). Parse as KEY=VALUE pairs, ignoring blank lines and comments.

If the file doesn't exist: tell the user to create `~/.scaffold-anything/.env` using the `.env.example` from the repo at `noshit-software/ns.s-scaffold-anything`. Stop.

---

## 2. Gather inputs

Ask each question in sequence. Do not proceed until each is answered.

**Repo name**
- Must be lowercase, hyphens only, no spaces
- Remind the user of any org naming convention visible from their existing repos (e.g. `ns.s-` prefix for noshit-software)

**Org**
- Show a numbered menu from `SCAFFOLD_GITHUB_ORGS` (comma-separated)
- User picks a number

**Description**
- One-line repo description

**Layers** — present each as a numbered menu, user picks one per category:

```
Frontend:  [1] React+Vite  [2] BabylonJS+Vite  [3] Three.js+Vite  [4] Next.js  [5] none
Backend:   [1] Express     [2] FastAPI          [3] none
Database:  [1] MySQL       [2] none
Auth:      [1] Clerk       [2] Passport/JWT     [3] none
Deploy:    [1] PM2         [2] Docker           [3] none
```

**Confirm**
Show a summary of all selections and ask to proceed (y/n).

---

## 3. Assign port

Based on backend layer, assign the next available port from the appropriate range in config:
- Express → `SCAFFOLD_PORT_RANGE_EXPRESS`
- FastAPI → `SCAFFOLD_PORT_RANGE_FASTAPI`
- Next.js (no separate backend) → `SCAFFOLD_PORT_RANGE_NEXTJS`
- Vite dev server → `SCAFFOLD_PORT_RANGE_VITE_DEV`
- none → no port needed

To pick the port: use the start of the range as the default. Tell the user which port was assigned and ask them to confirm it's free.

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
- `README.md` — repo name, description, stack, `pnpm dev` quickstart

### Conventions to enforce in every project
- Single start command: `pnpm dev` boots everything (use `concurrently` if multiple processes)
- Env validated on startup — fail fast with a clear message if required vars are missing
- Standard API response shape for any backend: `{ success: bool, data: any, error?: string }`
- Error handler registered as the last Express middleware
- All secrets in `.env`, never hardcoded

---

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
    db.ts          (only if DB=MySQL)
tsconfig.json
package.json  (scripts: dev [tsx watch], build [tsc], start)
```
- Middleware order: helmet → morgan → cors → json → routes → errorHandler
- DB module exports a pool, validates `DB_HOST/DB_USER/DB_PASS/DB_NAME` on import

### Layer: FastAPI

```
app/
  main.py       — FastAPI app, CORS, router registration
  routes/
    __init__.py
  lib/
    db.py         (only if DB=MySQL)
pyproject.toml  (uv managed)
.python-version
```
- Use `uv` as package manager
- Startup on port from assigned port range (`uvicorn app.main:app --port {port}`)
- If frontend layer also selected: root `package.json` with `concurrently` to run both

### Layer: MySQL

- Add `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT` to `.env.example`
- Add `src/lib/db.ts` (Express) or `app/lib/db.py` (FastAPI) with connection pool
- Add `schema.sql` at repo root with `CREATE DATABASE IF NOT EXISTS` + initial tables stub

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
    script: 'dist/index.js',  // or 'app/main.py' for FastAPI
    env: { NODE_ENV: 'production', PORT: {assigned-port} }
  }]
}
```

Also output an nginx server block snippet (don't write a file — print it so the user can paste it):

```nginx
server {
    listen 80;
    server_name {repo-name}.{SCAFFOLD_CF_DOMAIN};

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

### Layer: Docker (Deploy)

Generate `Dockerfile` and `docker-compose.yml` appropriate for the backend layer.

---

## 6. Create Cloudflare DNS record

Make a POST to the Cloudflare API to create an A record:
- Subdomain: `{repo-name}.{SCAFFOLD_CF_DOMAIN}`
- Points to: `{SCAFFOLD_SERVER_HOST}`
- Proxied: true

```
POST https://api.cloudflare.com/client/v4/zones/{SCAFFOLD_CF_ZONE_ID}/dns_records
Authorization: Bearer {SCAFFOLD_CF_API_TOKEN}
{
  "type": "A",
  "name": "{repo-name}",
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

```
✓ Repo:      https://github.com/{org}/{repo-name}
✓ Local:     {workspace}/{repo-name}
✓ DNS:       {repo-name}.{SCAFFOLD_CF_DOMAIN} → {SCAFFOLD_SERVER_HOST}
✓ Port:      {assigned-port}

Next steps:
  1. Copy .env.example → .env and fill in values
  2. pnpm install
  3. pnpm dev
  4. On server: paste nginx config into {SCAFFOLD_SERVER_NGINX_SITES}/{repo-name}
               then: sudo nginx -t && sudo systemctl reload nginx
               then: pm2 start ecosystem.config.js && pm2 save
```
