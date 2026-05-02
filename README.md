# scaffold-anything

A Claude Code skill that scaffolds new projects from scratch with à la carte layers.

## What it does

Invoke `/scaffold-anything` in Claude Code and it will:

1. Ask for a repo name, org, and description
2. Let you pick layers (frontend, backend, database, auth, deploy)
3. Create the GitHub repo and clone it locally
4. Scaffold all project files with consistent structure and conventions enforced
5. Create a Cloudflare DNS subdomain
6. Output nginx + PM2 config ready to paste on your server

## Setup

**1. Install the skill**

Copy `.claude/skills/scaffold-anything.md` to your global Claude skills directory:

```bash
cp .claude/skills/scaffold-anything.md ~/.claude/skills/scaffold-anything.md
```

**2. Create your config**

```bash
mkdir -p ~/.scaffold-anything
cp .env.example ~/.scaffold-anything/.env
```

Fill in `~/.scaffold-anything/.env` with your values.

**3. Validate your config**

```bash
npm run validate
```

## Layers

| Category | Options |
|----------|---------|
| Frontend | React+Vite, BabylonJS+Vite, Three.js+Vite, Next.js, none |
| Backend  | Express, FastAPI, none |
| Database | MySQL, none |
| Auth     | Clerk, Passport/JWT, none |
| Deploy   | PM2, Docker, none |
