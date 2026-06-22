-- Add admin-editable menu link to venues and rules/blind-structure link to events.
ALTER TABLE "venues"
  ADD COLUMN IF NOT EXISTS "menuUrl" TEXT;

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "rulesUrl" TEXT;
