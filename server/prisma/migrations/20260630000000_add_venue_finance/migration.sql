-- Add venue-level invoices/bills and ledger transactions
CREATE TYPE "VenueInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'WAIVED', 'FAILED');

CREATE TABLE "venue_invoices" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "managerId" TEXT,
  "createdById" TEXT NOT NULL,
  "amountSats" INTEGER NOT NULL,
  "memo" TEXT NOT NULL,
  "internalNote" TEXT,
  "status" "VenueInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "paymentRequest" TEXT,
  "paymentHash" TEXT,
  "expiresAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "waivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "venue_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venue_ledger_transactions" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "userId" TEXT,
  "amountSats" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "venue_ledger_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "venue_invoices_paymentHash_key" ON "venue_invoices"("paymentHash");
CREATE INDEX "venue_invoices_venueId_idx" ON "venue_invoices"("venueId");
CREATE INDEX "venue_invoices_managerId_idx" ON "venue_invoices"("managerId");
CREATE INDEX "venue_invoices_status_idx" ON "venue_invoices"("status");
CREATE INDEX "venue_ledger_transactions_venueId_idx" ON "venue_ledger_transactions"("venueId");
CREATE INDEX "venue_ledger_transactions_invoiceId_idx" ON "venue_ledger_transactions"("invoiceId");

ALTER TABLE "venue_invoices" ADD CONSTRAINT "venue_invoices_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_invoices" ADD CONSTRAINT "venue_invoices_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "venue_invoices" ADD CONSTRAINT "venue_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "venue_ledger_transactions" ADD CONSTRAINT "venue_ledger_transactions_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_ledger_transactions" ADD CONSTRAINT "venue_ledger_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "venue_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "venue_ledger_transactions" ADD CONSTRAINT "venue_ledger_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
