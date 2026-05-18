-- Add Lightning deposits for user balance funding
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'SETTLED', 'EXPIRED', 'FAILED');

CREATE TABLE "lightning_deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountSats" INTEGER NOT NULL,
    "paymentRequest" TEXT NOT NULL,
    "paymentHash" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lightning_deposits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lightning_deposits_paymentHash_key" ON "lightning_deposits"("paymentHash");
CREATE INDEX "lightning_deposits_userId_createdAt_idx" ON "lightning_deposits"("userId", "createdAt");
CREATE INDEX "lightning_deposits_status_expiresAt_idx" ON "lightning_deposits"("status", "expiresAt");

ALTER TABLE "lightning_deposits" ADD CONSTRAINT "lightning_deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
