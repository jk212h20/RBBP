<!--
Thanks for opening a PR! Please fill out the sections below.
Delete any sections that don't apply.
-->

## What

<!-- Brief description of what this PR does. 1–3 sentences. -->

## Why

<!-- Motivation. Link to issue, user request, or context. -->

## How

<!-- Key implementation notes. Anything non-obvious the reviewer should know. -->

## Checklist

- [ ] Branch follows `feature/<initials>-<desc>` format (or `fix/`, `docs/`, `chore/`)
- [ ] Tested locally (client + server both run without errors)
- [ ] `cd server && npm run build` passes
- [ ] `cd client && npm run build` passes
- [ ] Prisma migration added (if schema changed) and named with `YYYYMMDDHHMMSS_` prefix
- [ ] New env vars added to README's Environment Variables table (and set in Railway)
- [ ] `memory-bank/activeContext.md` updated (if architecturally significant)
- [ ] Entry added to `CHANGELOG.md` under `[Unreleased]`
- [ ] Screenshots or video attached (if UI change)
- [ ] Partner / human reviewer assigned (required for AI-agent PRs before merge)

## Deploy Notes

<!--
Anything special about this going to Railway?
- New env vars to configure in Railway dashboard?
- Database migration that needs attention during deploy?
- Order-of-operations concerns (e.g., deploy server before client)?
-->

## Screenshots / Video

<!-- For UI changes. Drag-and-drop images here. -->
