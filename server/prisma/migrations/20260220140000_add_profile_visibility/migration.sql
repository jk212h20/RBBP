-- Add visibility fields to profiles table
ALTER TABLE "profiles" ADD COLUMN "telegramVisibility" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "profiles" ADD COLUMN "socialLinksVisibility" TEXT NOT NULL DEFAULT 'PUBLIC';
