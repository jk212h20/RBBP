-- Drop the unused `pointsStructure` column from the seasons table.
-- This JSON column was never read by the scoring code; points are computed by
-- `calculateEventPoints(playerCount)` in server/src/services/event.service.ts
-- using a hardcoded pool formula (60/30/10% split). Removing it cleans up the
-- schema and the admin UI.

ALTER TABLE "seasons" DROP COLUMN IF EXISTS "pointsStructure";
