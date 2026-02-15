-- AlterTable: Add Last Longer Pool fields to events
ALTER TABLE "events" ADD COLUMN "lastLongerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "lastLongerSeedSats" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "events" ADD COLUMN "lastLongerEntrySats" INTEGER NOT NULL DEFAULT 25000;

-- CreateTable: Last Longer Pool Entries
CREATE TABLE "last_longer_entries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountSats" INTEGER NOT NULL,
    "paymentHash" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "last_longer_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "last_longer_entries_eventId_userId_key" ON "last_longer_entries"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "last_longer_entries" ADD CONSTRAINT "last_longer_entries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "last_longer_entries" ADD CONSTRAINT "last_longer_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add winnerId to events for tracking who won the last longer pool
ALTER TABLE "events" ADD COLUMN "lastLongerWinnerId" TEXT;

-- AddForeignKey for winner
ALTER TABLE "events" ADD CONSTRAINT "events_lastLongerWinnerId_fkey" FOREIGN KEY ("lastLongerWinnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
