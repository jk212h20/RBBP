-- Add nostrPubkey and nostrVisibility to profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "nostrPubkey" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "nostrVisibility" TEXT NOT NULL DEFAULT 'ADMIN_ONLY';

-- Change defaults for existing visibility columns to ADMIN_ONLY
ALTER TABLE "profiles" ALTER COLUMN "telegramVisibility" SET DEFAULT 'ADMIN_ONLY';
ALTER TABLE "profiles" ALTER COLUMN "socialLinksVisibility" SET DEFAULT 'ADMIN_ONLY';
