-- Fix column name mismatch: migration 20260219180000 created snake_case columns
-- but Prisma schema expects camelCase (no @map annotations).
-- This renames them IF they exist as snake_case. Uses DO blocks for safety.

DO $$
BEGIN
  -- Rename sort_order -> sortOrder if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE "daily_puzzles" RENAME COLUMN "sort_order" TO "sortOrder";
  END IF;

  -- Rename used_at -> usedAt if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'used_at'
  ) THEN
    ALTER TABLE "daily_puzzles" RENAME COLUMN "used_at" TO "usedAt";
  END IF;
END $$;
