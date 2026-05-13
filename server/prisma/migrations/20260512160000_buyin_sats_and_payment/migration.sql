-- Convert buy-in from USD (Float) to satoshis (Int) and add prepay discount config.
-- Per product decision, any existing buyIn values were USD numbers and would be
-- meaningless to reinterpret as sats, so we drop the old column.
ALTER TABLE "events" DROP COLUMN IF EXISTS "buyIn";
ALTER TABLE "events" ADD COLUMN "buyInSats"           INTEGER;
ALTER TABLE "events" ADD COLUMN "prepayDiscountSats"  INTEGER DEFAULT 0;
ALTER TABLE "events" ADD COLUMN "prepayDiscountHours" INTEGER NOT NULL DEFAULT 3;

-- Track buy-in payments on each signup.
ALTER TABLE "event_signups" ADD COLUMN "paymentHash"    TEXT;
ALTER TABLE "event_signups" ADD COLUMN "paidAt"         TIMESTAMP(3);
ALTER TABLE "event_signups" ADD COLUMN "paidAmountSats" INTEGER;
ALTER TABLE "event_signups" ADD COLUMN "payOnArrival"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "event_signups" ADD COLUMN "paidInPerson"   BOOLEAN NOT NULL DEFAULT false;
