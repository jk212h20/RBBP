# Daily Workflow — RBBP (Roatan Bitcoin Bar Poker)

Your personal checklist for a clean start each day, working on this project, and shipping to production.

Companion doc: `docs/LOCAL_DEV.md` (first-time setup — you only run those steps once per machine).

Repo location on your machine: `C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP`

> **Difference from btcpokerchamp:** RBBP is a two-service app — a Next.js **client** and an Express **server** — running on different ports. You need two dev terminals, not one.

---

## Part 1 — Start Of Day: Clean Slate

### 1.1 Kill any running dev servers

```powershell
# Kill every Node process — the simplest way to make sure yesterday isn't lingering
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Or surgically kill only RBBP's processes:

```powershell
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmd -match "NEWRBBP|RBBP\\server|RBBP\\client") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}
```

### 1.2 Stop all Docker containers

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
docker stop rbbp-postgres btcpokerchamp-postgres 2>&1
```

### 1.3 Verify nothing is listening on the app/DB ports

```powershell
# RBBP uses 3000 (client) and 3001 (server). Postgres uses 5432.
Get-NetTCPConnection -LocalPort 3000, 3001, 5432, 5555 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess
```

Expected: empty. If anything shows, `Stop-Process -Id <OwningProcess>` it.

### 1.4 Pick your project for the day

If you're working on btcpokerchamp instead, close this doc and open its `docs/DAILY_WORKFLOW.md`.

---

## Part 2 — Spin Up RBBP Locally

### 2.1 Start Postgres

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
docker start rbbp-postgres

Start-Sleep -Seconds 3
docker exec rbbp-postgres pg_isready -U postgres
```

Expected: `/var/run/postgresql:5432 - accepting connections`

### 2.2 Sync from GitHub

```powershell
cd C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP
git checkout main
git pull
```

If Nick added new dependencies or migrations overnight, update your local env:

```powershell
# Server deps
cd server
npm install
# Sync schema (RBBP uses db push locally due to no baseline migration — see DEV_NOTES §4)
npx prisma db push
npx prisma generate

# Client deps
cd ..\client
npm install
```

### 2.3 Start BOTH dev servers (two terminals)

You need TWO PowerShell terminals for RBBP.

**Terminal 1 — server** (Express backend on port 3001):
```powershell
cd C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP\server
npm run dev
```

**Terminal 2 — client** (Next.js frontend on port 3000):
```powershell
cd C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP\client
npm run dev
```

Leave both terminals open all day. `Ctrl + C` in each to stop.

App is live at http://localhost:3000 — client hits the local server on port 3001 automatically.

---

## Part 3 — Doing Work

### 3.1 Always work on a feature branch, never on main

```powershell
# From repo root
cd C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP
git checkout -b feature/jk-<short-description>
```

Examples:
- `feature/jk-fix-leaderboard-sort`
- `feature/jk-add-tournament-payout`
- `fix/jk-checkin-timezone-bug`

### 3.2 Make your changes

Edit files. Save. Both dev servers hot-reload automatically.

If you touch `server/prisma/schema.prisma`, tell Nick in chat first (see `CONTRIBUTING.md` §6 — Prisma migrations are RBBP's biggest tandem hazard).

### 3.3 Commit as you go

```powershell
git add -A
git status
git commit -m "feat: short description of the change"
```

Commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `style:`.

---

## Part 4 — Ship To Production

### 4.1 Local verification (mandatory before push)

Stop both dev servers first (`Ctrl + C` in each terminal), then from repo root:

```powershell
pwsh -File scripts/verify.ps1
```

Expected end: `All checks passed. Safe to push.`

This runs `prisma generate + tsc` on the server and `next build` on the client — same checks CI does. Takes ~20 seconds.

### 4.2 Push the branch

```powershell
git push -u origin feature/jk-<short-description>
```

### 4.3 Open the PR on GitHub

Follow the link the push output prints, or go to:
`https://github.com/jk212h20/RBBP/pull/new/feature/jk-<short-description>`

Fill in the PR template. Assign Nick as reviewer.

### 4.4 Merge (squash) after review

Nick reviews → approves → click **Squash and merge** on GitHub. Delete the branch.

### 4.5 Railway auto-deploys — no manual step needed

Unlike btcpokerchamp, RBBP's GitHub → Railway auto-deploy is working. On merge:
- Railway auto-builds both `client` (service `2157daaa`) and `server` (service `88b52535`)
- Deploy takes 2–4 min per service, in parallel

Watch progress: https://railway.com (find the RBBP project in Nick's workspace).

### 4.6 Verify production

```powershell
# Client should return 200 and show the new content
Invoke-WebRequest https://www.rbbp.fun/ -Method Head -UseBasicParsing | Select-Object StatusCode
```

Open the site in a browser: **https://www.rbbp.fun**. Hard-refresh with `Ctrl + Shift + R` if your browser cached the old version.

### 4.7 If auto-deploy misses (rare)

Commit an empty `.deploy-trigger` file to force Railway to redeploy (see `docs/DEV_NOTES.md` §2):

```powershell
"" | Set-Content .deploy-trigger
git add -f .deploy-trigger
git commit -m "chore: trigger railway redeploy"
git push
```

---

## Part 5 — End Of Day

### 5.1 Commit anything half-finished

```powershell
git add -A
git commit -m "wip: <what you were doing>"
git push
```

### 5.2 Stop both dev servers

`Ctrl + C` in the server terminal and the client terminal.

### 5.3 Stop Postgres

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
docker stop rbbp-postgres
```

### 5.4 (Optional) Quit Docker Desktop

Right-click whale in system tray → Quit.

---

## Cheatsheet — All Commands In One Place

```powershell
# START OF DAY
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
docker stop rbbp-postgres btcpokerchamp-postgres 2>&1

# SPIN UP RBBP
docker start rbbp-postgres
cd C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP
git checkout main; git pull

# Terminal 1 (server):
cd server; npm run dev           # http://localhost:3001

# Terminal 2 (client):
cd client; npm run dev           # http://localhost:3000

# NEW WORK
git checkout -b feature/jk-<desc>
# ...edit, save, preview...
git add -A; git commit -m "feat: ..."

# SHIP
# Ctrl+C both dev servers first
pwsh -File scripts/verify.ps1
git push -u origin feature/jk-<desc>
# Open PR on GitHub → review → squash merge
# Railway auto-deploys \u2014 no manual step

# END OF DAY
# Ctrl+C both dev servers
docker stop rbbp-postgres
```

---

## Troubleshooting

### "docker: command not found"

`$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path` in the current shell.

### Client fails to load / shows API errors

Server isn't running. Check Terminal 1 has `npm run dev` for the server.

### Prisma errors when starting server

`cd server; npx prisma db push` (**not** `migrate deploy` — RBBP has no baseline migration, see DEV_NOTES §4).

### `pwsh -File scripts/verify.ps1` fails with EPERM on Prisma DLL

Dev servers are still running. `Ctrl + C` them both, wait 3 seconds, retry.

### Client build fails with `useSearchParams` errors

Next.js 16 requires `<Suspense>` around anything using `useSearchParams`. See `docs/DEV_NOTES.md` §5.

### After merge, Railway isn't redeploying

Most common: the affected service (client vs server) didn't have any file changes so Railway skipped it. Use the `.deploy-trigger` trick from step 4.7.

### `git pull` shows a lot of file changes I didn't make

Nick was busy. Sync, then check `docs/DEV_NOTES.md` and `memory-bank/activeContext.md` for what he changed. Talk to him if it affects your in-progress work.

---

## Reference

- Live site: https://www.rbbp.fun
- Railway services: server `88b52535`, client `2157daaa`
- Contributor rules: `CONTRIBUTING.md`
- First-time setup: `docs/LOCAL_DEV.md`
- Gotchas and history: `docs/DEV_NOTES.md`
- Agent handoff / current state: `memory-bank/activeContext.md`
