-- Per-event toggle for registration/cancellation points.
-- When false: signup awards 0 pts, cancel/no-show apply no penalty.
-- Defaults to true to preserve existing behavior for all events created so far.
ALTER TABLE "events"
  ADD COLUMN "registrationPointsEnabled" BOOLEAN NOT NULL DEFAULT true;
