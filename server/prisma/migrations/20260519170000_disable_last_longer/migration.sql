-- Disable Last Longer pools now that Side Bets cover this use case.
UPDATE "events" SET "lastLongerEnabled" = false WHERE "lastLongerEnabled" = true;
