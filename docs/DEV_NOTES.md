# Developer Notes

A running, reverse-chronological log of decisions, gotchas, and "why we did X" notes between partners and agents working on this repo.

> **This is distinct from `memory-bank/activeContext.md`:**
> - `activeContext.md` = AI-agent session handoff state (what's current)
> - `DEV_NOTES.md` = human-to-human notes on tricky bits, decisions, and accumulated wisdom

---

## Template For New Entries

Copy and paste at the top of the entries section:

```md
## YYYY-MM-DD — <author initials> — <short title>

<What you learned / decided / fixed. Why it matters. Any links to commits, PRs, or issues.>
```

---

# Entries (newest first)

## 2026-07-27 — jk — Local dev environment setup on Windows

> **Full step-by-step guide:** `docs/LOCAL_DEV.md`. The section below captures the *decisions and gotchas* behind that guide.

Documenting the setup so future partners/agents don't rediscover it. All commands run from the repo root (whatever path you cloned to — e.g. `C:\Users\ASUS\Documents\repos\NEWRBBP\RBBP` on Windows, or `~/repos/RBBP` on macOS/Linux).

### Prerequisites
- Node 20+ (tested with v24.18.0)
- npm 10+ (tested with 12.0.1)
- Docker Desktop (for local Postgres)
- Git for Windows with credential manager

### Install dependencies
```powershell
cd server; npm install
# npm 12+ blocks postinstall scripts by default. Approve Prisma:
npm install-scripts approve @prisma/client @prisma/engines prisma
npx prisma generate

cd ../client; npm install
npm install-scripts approve sharp unrs-resolver
```

### Fast pre-push verification
`pwsh -File scripts/verify.ps1` from repo root — same steps as CI. No DB required. Catches TS errors and Next.js build errors.

### Full local dev (with database)
1. Ensure Docker Desktop is running (whale icon in system tray)
2. Start Postgres:
   ```powershell
   docker run --name rbbp-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=roatan_poker -p 5432:5432 -d postgres:16
   ```
   To stop/start later: `docker stop rbbp-postgres` / `docker start rbbp-postgres`
3. Create `server/.env` from `server/.env.example`, keep the default `DATABASE_URL` (matches the container above)
4. Sync schema to DB: `cd server; npx prisma db push` **(not `migrate dev` — see gotcha below)**
5. Create `client/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
6. Run both dev servers (in separate terminals — each blocks its terminal):
   - Terminal 1: `cd server; npm run dev` → http://localhost:3001
   - Terminal 2: `cd client; npm run dev` → http://localhost:3000

### ⚠️ Prisma migration gotcha for local dev
`npx prisma migrate deploy` **fails** on a fresh local DB because the first migration in the repo (`20260201220000_add_name_set_at`) alters a `users` table that doesn't exist yet — there is no initial baseline migration that creates the base schema. The production DB was seeded with `prisma db push` before migrations were adopted.

**For local dev:** use `npx prisma db push` — syncs the schema from `schema.prisma` directly, bypassing the migration history. Fast and works every time.

**For production changes:** continue using proper migrations (`prisma migrate dev` to create a new one, Prisma applies it in production). Don't `db push` to production.

**Optional cleanup for the future:** someone should write a squashed baseline migration and re-baseline the production DB using `prisma migrate resolve`. Not urgent — current setup works.

### Gotchas
- Newer Node (v24) works despite CI running Node 20. If you hit strange errors, fall back to Node 20 via `nvm-windows`.
- PowerShell in this repo often prints "NativeCommandError" wrappers around benign stderr output (e.g., npm progress, git remote messages). If the exit code is 0 and there's no explicit error text, ignore the wrapper.
- `.env` files are gitignored and must never be committed.

---

## 2026-04-17 — setup — Coordination docs bootstrapped

Created `CONTRIBUTING.md`, `CHANGELOG.md`, this file, a PR template, and a CI workflow. Branch: `feature/docs-coordination-setup`. This file itself is the first entry and the template lives above.

Going forward: any time you hit something non-obvious, drop a note here so the next person (or agent) doesn't re-discover it from scratch.

---

## Seeded Notes — Things To Know About This Repo

### 1. Railway auto-deploys `main`

Every merge to `main` → both the client (`2157daaa`) and server (`88b52535`) Railway services redeploy automatically. Treat `main` like production.

**Rollback:** `git revert <sha> && git push` — Railway redeploys the reverted state.

**Deploy status:** check https://railway.app after each merge.

---

### 2. The `.deploy-trigger` trick

Sometimes Railway misses a change (usually when only a non-source file changed, or after CLI config drift). The workaround: touch a file named `.deploy-trigger` and commit it. Example commits where this was used:

- `b391b3f` — Trigger client deploy
- `fb5f12c` — Trigger Railway deploy

`.deploy-trigger` is in `.gitignore`, so you commit it explicitly with `git add -f .deploy-trigger`. Used sparingly — prefer fixing the root cause if Railway keeps missing changes.

---

### 3. Railway service linkage (historical fix)

Server dir → Railway service `88b52535` (RBBP)
Client dir → Railway service `2157daaa` (client)

Both dirs were briefly deploying to the client service due to stale Railway CLI config. Fixed in commit `ac59555`. If CLI behavior gets weird again, re-verify `railway link` in each directory.

---

### 4. Prisma migrations are the #1 tandem hazard

Coordinate timing in chat before editing `server/prisma/schema.prisma`. Never rename an already-applied migration folder. Follow timestamp ordering (`YYYYMMDDHHMMSS_name`). If two branches both add migrations, the second-to-merge must rebase and rename their migration to a later timestamp before merging.

See `CONTRIBUTING.md` Section 6 for the full etiquette.

---

### 5. Next.js 16 `useSearchParams` needs `<Suspense>`

Production builds will fail if `useSearchParams` (or similar hooks) are used at the top level of a page without a `<Suspense>` boundary. The `/register` page broke with this exact issue — fix is in commit `e3973fe`.

Rule of thumb: any client component using `useSearchParams` should be wrapped in `<Suspense fallback={...}>`.

---

### 6. Next.js standalone build on Railway

Two non-obvious requirements:

1. **`HOSTNAME=0.0.0.0`** env var must be set in Railway for the client service — otherwise Next.js binds only to 127.0.0.1 and the health check fails. See commit `fc1f122`.
2. **Static assets must be copied** into the `.next/standalone` output for the standalone server to serve them. See commit `57265c5`.

If the client deploys but returns 404 / broken styles, one of these two is probably wrong.

---

### 7. Memory-bank convention

The `memory-bank/` folder is the AI agent's durable context:

| File | Purpose |
|---|---|
| `projectbrief.md` | Requirements & scope |
| `activeContext.md` | Current state + recent changes (update after meaningful work) |
| `progress.md` | Feature completion checklist |
| `systemPatterns.md` | Architecture & design patterns |
| `techContext.md` | Tech setup & deployment guide |
| `features/*.md` | Per-feature detail docs |

**Agent rule:** update `activeContext.md` at the end of any session that made architecturally significant changes.

---

### 8. Timezone: hardcoded Central for Roatan

Roatan runs CST year-round (no DST). Server code hardcodes the CST offset rather than deriving from server locale (Railway containers may be UTC). Relevant fix: commit `86dab26`. Don't swap to a generic `toLocaleDateString()` without accounting for this — event times will drift by hours.

Also see:
- Daily puzzle rotation: noon Central = 18:00 UTC (commit `3e482d7`)

---

### 9. Telegram username is stored without `@` prefix

On `UserProfile.telegramUsername`. Don't persist the `@`. The `notifyAdmins()` fan-out only sends to admins where `telegramVerified=true` AND the relevant notification pref is enabled.

---

### 10. Points source of truth

`PointsHistory` is the sole source of truth for a user's point total. Leaderboard and profile breakdowns compute from it plus registration points. Multiple commits (`02aef7d`, `9ff4bd8`, `8995eca`, `4211cd0`) tightened this — don't introduce parallel points calculations.

---

<!-- Add new entries ABOVE this line, below the Template section -->
