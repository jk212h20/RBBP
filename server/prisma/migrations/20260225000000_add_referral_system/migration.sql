-- Add referral system fields to users table
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN "referredById" TEXT;
ALTER TABLE "users" ADD COLUMN "referralRewardPaid" BOOLEAN NOT NULL DEFAULT false;

-- Create unique index on referralCode
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- Add foreign key for referredById
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Generate referral codes for all existing users
-- Uses first 8 chars of a random gen_random_uuid (hex-like, unique enough)
UPDATE "users" SET "referralCode" = LOWER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE "referralCode" IS NULL;
