-- Add claim token fields for guest account claiming
ALTER TABLE "users" ADD COLUMN "claimToken" TEXT;
ALTER TABLE "users" ADD COLUMN "claimTokenExpiry" TIMESTAMP(3);

-- Index for fast token lookup
CREATE UNIQUE INDEX "users_claimToken_key" ON "users"("claimToken");
