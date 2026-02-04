-- Add WAITLISTED status to SignupStatus enum
ALTER TYPE "SignupStatus" ADD VALUE 'WAITLISTED';

-- Update default maxPlayers to 20 for new events
ALTER TABLE "events" ALTER COLUMN "maxPlayers" SET DEFAULT 20;

-- Update existing events to have maxPlayers = 20
UPDATE "events" SET "maxPlayers" = 20 WHERE "maxPlayers" > 20;
