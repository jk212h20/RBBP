# Contributing to Roatan Poker League (RBBP)

Welcome! This guide is for the two human partners and any AI coding agents working on this repo.

> **Heads up:** `main` auto-deploys to Railway (production). Every merge ships. Treat it like production.

---

## TL;DR Cheatsheet

```bash
# Start of session
git checkout main
git pull
git checkout -b feature/<initials>-<short-desc>

# While working
# ...edit code...
git add -A
git commit -m "feat: short imperative summary"
git push -u origin feature/<initials>-<short-desc>

# Before opening PR
cd server && npm run build   # must pass
cd ../client && npm run build # must pass

# Open PR on GitHub → partner reviews → squash merge → branch auto-deletes
```

---

## 1. Before You Start a Session

1. Pull the latest `main`: `git checkout main && git pull`
2. Skim `memory-bank/activeContext.md` to see what was done last
3. Post in the shared chat: *"Starting work on X, branch `feature/jk-short-desc`"*
4. Create your branch from latest `main`

This prevents two people (or an agent and a human) starting from stale code.

---

## 2. Branching

**Format:** `<type>/<initials>-<short-desc>`

- `feature/jk-side-bet-pagination`
- `fix/ab-leaderboard-off-by-one`
- `docs/jk-update-readme`
- `chore/ab-bump-next-version`

**Rules:**
- Always branch from the latest `main`
- Keep branches short-lived — aim for 1–3 days
- One logical change per branch (don't mix refactor + feature)
- Delete the branch after merge (GitHub does this automatically when configured)

---

## 3. Commit Messages — Conventional Commits

Use a prefix from this list:

| Prefix | Use for |
|---|---|
| `feat:` | New user-visible feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change that doesn't add features or fix bugs |
| `chore:` | Tooling, deps, build config |
| `test:` | Adding or fixing tests |
| `style:` | Formatting, whitespace (no logic change) |

**Format:**
```
<prefix>[optional-scope]: <imperative summary in present tense>

[optional body explaining why, wrapped at ~72 cols]
```

**Good examples:**
- `feat(auth): add telegram verification flow`
- `fix: leaderboard points total now includes check-in points`
- `docs: document Railway service linkage in DEV_NOTES`

**Bad examples:**
- `updated stuff` ❌
- `WIP` ❌ (fine on your own branch; squash-merge will hide it anyway)
- `Fixed the thing that was broken` ❌ (not imperative, not specific)

---

## 4. Pull Request Process

1. Push your branch: `git push -u origin feature/...`
2. Open a PR on GitHub against `main`
3. Fill out the PR template (checklist appears automatically)
4. Request your partner's review — **required**, even for small changes
5. Address review comments by pushing new commits (don't force-push during review)
6. Once approved and CI is green → **Squash merge**
7. Delete the branch
8. Verify the Railway deploy succeeded on the live site

**Agent-authored PRs require human review before merge. Always.**

---

## 5. Why Squash Merge?

All PRs merge via **squash merge** — your branch's commits become one commit on `main`.

**Reasons:**
- Clean linear history on `main` — one commit per feature
- Agents produce noisy commits ("fix", "fix again", "oops"); squashing hides the mess
- Each commit on `main` = one deployable unit. If it breaks prod: `git revert <sha>` and you're back
- PR description preserves the full story forever on GitHub

---

## 6. ⚠️ Prisma Migration Etiquette (The #1 Tandem Hazard)

Migrations are the most common source of painful merge conflicts in this repo.

**Rules:**
1. **Announce before editing** `server/prisma/schema.prisma` in chat
2. **One migration per PR** (ideally)
3. **Never rename an existing migration folder** after it's been applied to prod — Prisma tracks by name
4. **Migration naming:** `YYYYMMDDHHMMSS_descriptive_name` (matches existing convention, e.g., `20260409000000_allow_multiple_side_bet_entries`)
5. **If two branches both add migrations:** the second-to-merge must rebase, rename their migration folder to a later timestamp, and test locally before merging
6. **Never edit an already-merged migration file** — write a new migration that fixes/reverses it

When in doubt: ask partner in chat before creating the migration.

---

## 7. Shared-File Coordination

These files are edited by almost every feature. Announce in chat before editing:

- `server/prisma/schema.prisma`
- `client/src/lib/api.ts`
- `client/src/app/admin/page.tsx`
- `client/src/context/AuthContext.tsx`
- `memory-bank/activeContext.md`

If both partners need to touch these at the same time, consider pairing instead of parallel work.

---

## 8. Local Testing Before Push

**One-command check** (recommended — runs the same steps as CI):

```powershell
# From repo root
pwsh -File scripts/verify.ps1
```

**Or manually:**

```bash
cd server && npm run build   # catches TS errors
cd client && npm run build   # catches Next.js 16 SSR/Suspense bugs
```

For schema changes:
```bash
cd server && npx prisma migrate dev
npx prisma studio  # sanity-check the DB
```

For UI changes: click through affected pages in dev server before pushing.

### First-time local build setup (Windows)

If `node_modules` doesn't exist yet:

```powershell
cd server; npm install
# npm 12+ blocks postinstall scripts by default. Approve Prisma:
npm install-scripts approve @prisma/client @prisma/engines prisma

cd ../client; npm install
npm install-scripts approve sharp unrs-resolver
```

Then run `pwsh -File scripts/verify.ps1` from the repo root to confirm both build.

### Full local dev (running the app)

Requires PostgreSQL. See **`docs/LOCAL_DEV.md`** for the complete Docker-based setup guide (env files, migrations, dev servers, troubleshooting). Deeper gotchas live in `docs/DEV_NOTES.md`.

---

## 9. Environment Variables & Secrets

- **Never commit** `.env`, `.env.local`, `server/.env` (already in `.gitignore` — keep it that way)
- If you add a new env var:
  - Add it to the README's Environment Variables table in the same PR
  - Add it to Railway's dashboard (server or client service as appropriate) — *before* merging the PR
- If the var is required, update `server/.env.example` if it exists

---

## 10. Railway Deploy Awareness

- **`main` = production.** Every squashed merge triggers an auto-deploy
- **Server** deploys to Railway service `88b52535` (root dir: `server/`)
- **Client** deploys to Railway service `2157daaa` (root dir: `client/`)
- **Hotfix rollback:** `git revert <sha> && git push` — Railway redeploys the reverted state
- **Force redeploy:** if Railway misses a change, touch `.deploy-trigger` and commit (see `docs/DEV_NOTES.md`)
- **Check deploy status:** https://railway.app after each merge

---

## 11. AI Agent Rules

1. Agents work on a branch opened by a human (or open their own `feature/agent-*` branch)
2. Agents **never** merge their own PRs
3. Agents **never** push directly to `main`
4. Agents must update `memory-bank/activeContext.md` when making architecturally significant changes
5. Humans review every agent diff before merging
6. If an agent produces noisy commits, squash-merge will clean them up

---

## 12. CHANGELOG

Every PR that changes user-visible behavior must add a line to `CHANGELOG.md` under the `[Unreleased]` heading. Categories:

- `Added` — new feature
- `Changed` — change in existing behavior
- `Fixed` — bug fix
- `Removed` — removed feature
- `Deprecated` — soon-to-be-removed feature
- `Security` — security fix

When we "release" (or at sensible intervals), the `[Unreleased]` contents get moved under a dated heading.

---

## 13. Branch Protection Setup (One-Time, Do On GitHub)

Go to **https://github.com/jk212h20/RBBP/settings/branches** → **Add rule** for `main`:

- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Select checks: `server-build`, `client-build` (will appear after first CI run)
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

Go to **https://github.com/jk212h20/RBBP/settings** → **General** → **Pull Requests**:

- ✅ Allow squash merging (set as **default**)
- ❌ Disable merge commits
- ❌ Disable rebase merging
- ✅ Automatically delete head branches

---

## 14. Quick Glossary

- **`main`** — the deployable branch. Protected. Only merged into via PR.
- **Feature branch** — where all work happens. Named `feature/<initials>-<desc>`.
- **Squash merge** — condense a PR's commits into one before landing on `main`.
- **CI** — GitHub Actions, runs on every PR. Builds both `client` and `server`. Must pass to merge.
- **Memory bank** — `memory-bank/` folder; durable project context, updated by humans + agents.
- **DEV_NOTES** — `docs/DEV_NOTES.md`; quick partner-to-partner log of decisions and gotchas.

---

## Questions?

- Repo: https://github.com/jk212h20/RBBP
- Live site: https://www.rbbp.fun/
- **Local dev setup:** `docs/LOCAL_DEV.md`
- Architecture docs: `memory-bank/systemPatterns.md`
- Setup (deploy): `README.md`
- Running notes / gotchas: `docs/DEV_NOTES.md`
