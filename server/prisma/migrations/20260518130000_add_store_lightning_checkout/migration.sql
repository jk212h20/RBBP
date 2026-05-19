-- Add pending/expired/failed statuses for invoice-based store checkout.
ALTER TYPE "StoreOrderStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "StoreOrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "StoreOrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- Add invoice payment fields to store orders.
ALTER TABLE "store_orders"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'BALANCE',
  ADD COLUMN "paymentRequest" TEXT,
  ADD COLUMN "paymentHash" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "store_orders_paymentHash_key" ON "store_orders"("paymentHash");
