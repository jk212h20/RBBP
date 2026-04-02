-- CreateEnum
CREATE TYPE "SideBetStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "side_bets" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "eventId" TEXT,
    "entrySats" INTEGER NOT NULL,
    "feePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SideBetStatus" NOT NULL DEFAULT 'OPEN',
    "winnerId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "side_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "side_bet_entries" (
    "id" TEXT NOT NULL,
    "sideBetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountSats" INTEGER NOT NULL,
    "paymentHash" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "side_bet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "side_bet_entries_sideBetId_userId_key" ON "side_bet_entries"("sideBetId", "userId");

-- AddForeignKey
ALTER TABLE "side_bets" ADD CONSTRAINT "side_bets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_bets" ADD CONSTRAINT "side_bets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_bets" ADD CONSTRAINT "side_bets_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_bet_entries" ADD CONSTRAINT "side_bet_entries_sideBetId_fkey" FOREIGN KEY ("sideBetId") REFERENCES "side_bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_bet_entries" ADD CONSTRAINT "side_bet_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
