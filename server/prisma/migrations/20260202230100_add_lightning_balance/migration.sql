-- Add lightning balance to users
ALTER TABLE "users" ADD COLUMN "lightningBalanceSats" INTEGER NOT NULL DEFAULT 0;
