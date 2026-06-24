-- Add a whole-event league scoring switch.
-- When false, the event can still have attendance/results/side bets, but should
-- not award league/season points or registration/no-show penalties.
ALTER TABLE "events"
  ADD COLUMN "leaguePointsEnabled" BOOLEAN NOT NULL DEFAULT true;
