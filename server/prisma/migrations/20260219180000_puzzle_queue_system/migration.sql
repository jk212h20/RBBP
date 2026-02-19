-- Switch from date-based to queue-based puzzle system
-- Add sortOrder for manual ordering, usedAt to track when a puzzle was shown

-- Add new columns
ALTER TABLE "daily_puzzles" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_puzzles" ADD COLUMN "usedAt" DATE;

-- Migrate existing data: copy date to usedAt, set sortOrder from date order
UPDATE "daily_puzzles" SET "usedAt" = "date";
UPDATE "daily_puzzles" AS dp SET "sortOrder" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "date" ASC) as rn FROM "daily_puzzles") sub
WHERE dp.id = sub.id;

-- Drop the unique constraint on date and the date column
ALTER TABLE "daily_puzzles" DROP COLUMN "date";
