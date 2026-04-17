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
