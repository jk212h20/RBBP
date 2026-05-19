-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PAID', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "store_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceSats" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "productId" TEXT NOT NULL,
    "priceSats" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "promoCodeId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePaidSats" INTEGER NOT NULL,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_product_variants_productId_size_key" ON "store_product_variants"("productId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "store_promo_codes_code_key" ON "store_promo_codes"("code");

-- CreateIndex
CREATE INDEX "store_orders_userId_idx" ON "store_orders"("userId");

-- CreateIndex
CREATE INDEX "store_orders_productId_idx" ON "store_orders"("productId");

-- AddForeignKey
ALTER TABLE "store_product_variants" ADD CONSTRAINT "store_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_promo_codes" ADD CONSTRAINT "store_promo_codes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "store_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "store_promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default shirt product, inventory, and launch promo.
INSERT INTO "store_products" ("id", "name", "description", "priceSats", "isActive", "createdAt", "updatedAt")
VALUES (
  'rbbp-shirt',
  'Roatan Bitcoin Bar Poker Shirt',
  'Official Roatan Bitcoin Bar Poker shirt. Select your size and pay with your site Lightning balance.',
  25000,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "store_product_variants" ("id", "productId", "size", "quantityAvailable", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('rbbp-shirt-small', 'rbbp-shirt', 'Small', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbbp-shirt-medium', 'rbbp-shirt', 'Medium', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbbp-shirt-large', 'rbbp-shirt', 'Large', 10, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbbp-shirt-xl', 'rbbp-shirt', 'XL', 10, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbbp-shirt-2xl', 'rbbp-shirt', '2XL', 5, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("productId", "size") DO NOTHING;

INSERT INTO "store_promo_codes" ("id", "code", "label", "productId", "priceSats", "maxUses", "uses", "isActive", "createdAt", "updatedAt")
VALUES (
  'rbbp-shirt-promo-1btct4me',
  '1BTCT4ME',
  'Launch shirt promo',
  'rbbp-shirt',
  10000,
  10,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
