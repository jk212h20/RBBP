-- Allow users to cancel unclaimed balance withdrawals and refund reserved site balance exactly once.
ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "fundedFromBalance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- Preserve cancellation/refund support for already-pending balance withdrawals created before this migration.
-- Admin-created withdrawals generally have custom descriptions and did not debit site balance.
UPDATE "withdrawals"
SET "fundedFromBalance" = true
WHERE "status" = 'PENDING'
  AND "description" LIKE 'Balance withdrawal - %';
