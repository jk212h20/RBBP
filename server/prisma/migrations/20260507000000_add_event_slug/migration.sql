-- Add nullable slug column for human-readable event URLs
ALTER TABLE "events" ADD COLUMN "slug" TEXT;

-- Backfill: build a base slug from the event name (lowercase, alphanumerics + hyphens),
-- then append a 6-char suffix from the event id to guarantee uniqueness across
-- recurring events that share the same name (e.g. "Friday Night Poker #3").
UPDATE "events"
SET "slug" = (
  -- 1) lowercase
  -- 2) replace any run of non-alphanumerics with a single hyphen
  -- 3) trim leading/trailing hyphens
  -- 4) collapse to at most ~60 chars
  -- 5) append "-<short id>" so duplicates can't collide
  trim(BOTH '-' FROM
    substr(
      regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'),
      1, 60
    )
  )
  || '-' || substr("id", 1, 6)
)
WHERE "slug" IS NULL;

-- If for some reason a row's name slugified to empty (e.g. all-symbols name),
-- fall back to using just the short id.
UPDATE "events"
SET "slug" = substr("id", 1, 8)
WHERE "slug" IS NULL OR "slug" = '' OR "slug" = '-';

-- Enforce uniqueness going forward
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
