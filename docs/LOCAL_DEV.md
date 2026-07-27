# Local Development Quick Start

Concentrated, copy-paste-friendly instructions for running RBBP locally on Windows. If you're new to the repo, start here.

For deeper context and gotchas, see `docs/DEV_NOTES.md`. For workflow rules, see `CONTRIBUTING.md`.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ (tested with v24.18.0) | https://nodejs.org |
| npm | 10+ (tested with 12.0.1) | Ships with Node |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop/ — needs WSL2 |
| Git for Windows | latest | With Credential Manager (default install option) |
| PowerShell | 5.1 or 7+ | 5.1 ships with Windows |

---

## First-time setup (once per machine)

### 1. Clone the repo

```powershell
git clone https://github.com/jk212h20/RBBP.git
cd RBBP
```

### 2. Configure git identity (if not already global)

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 3. Install dependencies

```powershell
# Server
cd server
npm install
npm install-scripts approve @prisma/client @prisma/engines prisma
npx prisma generate

# Client
cd ..\client
npm install
npm install-scripts approve sharp unrs-resolver
```

> `npm 12+` blocks postinstall scripts by default. The `install-scripts approve` calls whitelist the scripts required by Prisma, sharp (Next.js image processing), and unrs-resolver. The approvals are persisted in each `package.json` so contributors after you don't need to re-approve.

### 4. Start local Postgres via Docker

```powershell
# Ensure Docker Desktop is running (whale icon in system tray)

# One-time: pull + run the container
docker run --name rbbp-postgres `
  -e POSTGRES_PASSWORD=password `
  -e POSTGRES_DB=roatan_poker `
  -p 5432:5432 `
  -d postgres:16
```

Verify it's ready:

```powershell
docker exec rbbp-postgres pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections
```

### 5. Create env files

**`server/.env`** (copy from `server/.env.example`, then set at minimum):

```env
PORT=3001
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/roatan_poker?schema=public"
JWT_SECRET=local-dev-jwt-secret-not-for-production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
SESSION_SECRET=local-dev-session-secret-not-for-production
EMAIL_FROM=Roatan Poker <noreply@roatanpoker.com>
LIGHTNING_AUTH_URL=http://localhost:3001/api/auth/lightning
LNURL_BASE_URL=http://localhost:3001/api
```

Optional keys (Google OAuth, Voltage LND, Resend, Telegram) can be added later; the app degrades gracefully without them.

**`client/.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

> Both env files are in `.gitignore` — never commit them.

### 6. Sync the DB schema

```powershell
cd server
npx prisma db push
```

**Do NOT run `prisma migrate deploy` on a fresh local DB.** The first migration in the repo (`20260201220000_add_name_set_at`) alters a `users` table that no earlier migration creates — production was seeded with `db push` before migrations were adopted. `db push` reads `schema.prisma` and syncs directly, bypassing the migration history. See `docs/DEV_NOTES.md` for the full story.

You should now have ~27 tables in the `roatan_poker` database.

---

## Daily workflow

### Start the dev servers

Open **two** PowerShell terminals. Each blocks its terminal — that's expected.

**Terminal 1 — server:**
```powershell
cd C:\Users\ASUS\Documents\NEWRBBP\RBBP\server
npm run dev
```
Backend live at http://localhost:3001

**Terminal 2 — client:**
```powershell
cd C:\Users\ASUS\Documents\NEWRBBP\RBBP\client
npm run dev
```
Frontend live at http://localhost:3000

### Manage Postgres

```powershell
# Stop DB (frees the port; container + data persist)
docker stop rbbp-postgres

# Start DB again next session
docker start rbbp-postgres

# Inspect data with a GUI
cd server
npx prisma studio    # opens http://localhost:5555

# Wipe DB and start fresh (destructive)
docker exec -e PGPASSWORD=password rbbp-postgres `
  psql -U postgres -c "DROP DATABASE IF EXISTS roatan_poker;"
docker exec -e PGPASSWORD=password rbbp-postgres `
  psql -U postgres -c "CREATE DATABASE roatan_poker;"
cd server; npx prisma db push
```

### Before pushing a branch

```powershell
# From repo root — runs the same checks as CI
pwsh -File scripts/verify.ps1
```

If it prints "All checks passed. Safe to push." you're good.

---

## Common tasks

### Add or change a Prisma model

1. Edit `server/prisma/schema.prisma`
2. Create a migration for production:
   ```powershell
   cd server
   npx prisma migrate dev --name descriptive_name_here
   ```
   This creates a new migration folder (`YYYYMMDDHHMMSS_descriptive_name_here`) AND applies it to your local DB. Prisma will also run through the earlier failing migrations — if that errors, run `npx prisma db push` first to get local in sync, then `migrate dev` will create just the new migration file cleanly.
3. Announce in chat before editing `schema.prisma` (see `CONTRIBUTING.md` §6)

### Reset the DB to a known state

```powershell
docker stop rbbp-postgres
docker rm rbbp-postgres
# Then repeat step 4 of first-time setup, then step 6
```

### Change Docker port if 5432 is taken

Change the `-p 5432:5432` in the `docker run` command to `-p 5433:5432` (host:container), and update `DATABASE_URL` in `server/.env` to `localhost:5433`.

---

## Troubleshooting

### "docker: command not found"

Docker Desktop is installed but not on PATH for this shell. Either open a new PowerShell (new shells pick up the updated system PATH after Docker installs), or add it manually for the session:

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
```

### "npm: command not found" inside Start-Process

Windows treats `npm` as a shell script, not a Win32 executable. Use `npm.cmd` when invoking from `Start-Process` or scripts. Regular terminal use is fine.

### Prisma errors about relation "users" not existing

You ran `prisma migrate deploy` on a fresh DB. Recover:

```powershell
docker exec -e PGPASSWORD=password rbbp-postgres `
  psql -U postgres -c "DROP DATABASE IF EXISTS roatan_poker;"
docker exec -e PGPASSWORD=password rbbp-postgres `
  psql -U postgres -c "CREATE DATABASE roatan_poker;"
cd server
npx prisma db push
```

### PowerShell prints "NativeCommandError" wrapping npm/git output

Cosmetic — PowerShell 5.1 wraps any stderr from native commands (even benign progress/info) as an error. If the last line says "success" or "Compiled successfully" or shows an expected result, and the exit code is 0, ignore the wrapper.

### Next.js 16 build fails with `useSearchParams` error

Wrap the component using `useSearchParams` in `<Suspense fallback={...}>`. See `docs/DEV_NOTES.md` entry on Next.js 16 SSR/Suspense.

### `npm run build` client fails with `NEXT_PUBLIC_API_URL` missing

Set it as an env var for the build:

```powershell
$env:NEXT_PUBLIC_API_URL="http://localhost:3001/api"
npm run build
```

Or use `pwsh -File scripts/verify.ps1` which handles this automatically.

### Postgres container won't start / port conflict

Something else is on port 5432. Find and stop it, or use a different port (see "Change Docker port" above).

```powershell
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue |
  Select-Object OwningProcess, State
# Then: Get-Process -Id <that pid>
```

---

## Reference

- **Repo:** https://github.com/jk212h20/RBBP
- **Live site:** https://www.rbbp.fun/
- **Architecture:** `memory-bank/systemPatterns.md`
- **Deployment:** `memory-bank/techContext.md` and README's Railway section
- **Workflow rules:** `CONTRIBUTING.md`
- **Running notes / gotchas:** `docs/DEV_NOTES.md`
