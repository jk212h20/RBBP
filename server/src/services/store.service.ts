import prisma from '../lib/prisma';

export const DEFAULT_SHIRT_PRODUCT_ID = 'rbbp-shirt';
export const DEFAULT_SHIRT_PROMO_CODE = '1BtcT4me';
export const DEFAULT_SHIRT_PRICE_SATS = 25000;
export const DEFAULT_PROMO_PRICE_SATS = 10000;

const SHIRT_SIZES = [
  { size: 'Small', quantity: 10, sortOrder: 1 },
  { size: 'Medium', quantity: 10, sortOrder: 2 },
  { size: 'Large', quantity: 10, sortOrder: 3 },
  { size: 'XL', quantity: 10, sortOrder: 4 },
  { size: '2XL', quantity: 5, sortOrder: 5 },
];

export async function ensureDefaultStore() {
  await prisma.storeProduct.upsert({
    where: { id: DEFAULT_SHIRT_PRODUCT_ID },
    update: {},
    create: {
      id: DEFAULT_SHIRT_PRODUCT_ID,
      name: 'Roatan Bitcoin Bar Poker Shirt',
      description: 'Official Roatan Bitcoin Bar Poker shirt. Select your size and pay with your site Lightning balance.',
      priceSats: DEFAULT_SHIRT_PRICE_SATS,
      isActive: true,
      variants: {
        create: SHIRT_SIZES.map(size => ({
          size: size.size,
          quantityAvailable: size.quantity,
          sortOrder: size.sortOrder,
        })),
      },
    },
  });

  const existingVariants = await prisma.storeProductVariant.count({
    where: { productId: DEFAULT_SHIRT_PRODUCT_ID },
  });
  if (existingVariants === 0) {
    await prisma.storeProductVariant.createMany({
      data: SHIRT_SIZES.map(size => ({
        productId: DEFAULT_SHIRT_PRODUCT_ID,
        size: size.size,
        quantityAvailable: size.quantity,
        sortOrder: size.sortOrder,
      })),
    });
  }

  await prisma.storePromoCode.upsert({
    where: { code: DEFAULT_SHIRT_PROMO_CODE.toUpperCase() },
    update: {},
    create: {
      code: DEFAULT_SHIRT_PROMO_CODE.toUpperCase(),
      label: 'Launch shirt promo',
      productId: DEFAULT_SHIRT_PRODUCT_ID,
      priceSats: DEFAULT_PROMO_PRICE_SATS,
      maxUses: 10,
      uses: 0,
      isActive: true,
    },
  });
}

export async function getStorefront() {
  await ensureDefaultStore();

  const products = await prisma.storeProduct.findMany({
    where: { isActive: true },
    include: {
      variants: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return products.map(product => ({
    id: product.id,
    name: product.name,
    description: product.description,
    priceSats: product.priceSats,
    variants: product.variants.map(variant => ({
      id: variant.id,
      size: variant.size,
      quantityAvailable: variant.quantityAvailable,
      soldOut: variant.quantityAvailable <= 0,
    })),
  }));
}

export async function getAdminStore() {
  await ensureDefaultStore();

  const products = await prisma.storeProduct.findMany({
    include: {
      variants: { orderBy: { sortOrder: 'asc' } },
      promoCodes: { orderBy: { createdAt: 'asc' } },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const recentOrders = await prisma.storeOrder.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, size: true } },
      promoCode: { select: { code: true } },
    },
  });

  return { products, recentOrders };
}

export async function updateStoreProduct(productId: string, data: { description?: string; priceSats?: number; isActive?: boolean }) {
  const updateData: { description?: string; priceSats?: number; isActive?: boolean } = {};

  if (data.description !== undefined) {
    updateData.description = String(data.description).trim();
  }
  if (data.priceSats !== undefined) {
    const priceSats = Number(data.priceSats);
    if (!Number.isInteger(priceSats) || priceSats <= 0) {
      throw new Error('Price must be a positive whole number of sats');
    }
    updateData.priceSats = priceSats;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }

  return prisma.storeProduct.update({
    where: { id: productId },
    data: updateData,
    include: { variants: { orderBy: { sortOrder: 'asc' } }, promoCodes: true },
  });
}

export async function updateStoreVariant(variantId: string, data: { quantityAvailable?: number }) {
  const quantityAvailable = Number(data.quantityAvailable);
  if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
    throw new Error('Quantity must be a non-negative whole number');
  }

  return prisma.storeProductVariant.update({
    where: { id: variantId },
    data: { quantityAvailable },
  });
}

export async function updateStorePromoCode(promoId: string, data: { priceSats?: number; maxUses?: number; isActive?: boolean }) {
  const updateData: { priceSats?: number; maxUses?: number; isActive?: boolean } = {};

  if (data.priceSats !== undefined) {
    const priceSats = Number(data.priceSats);
    if (!Number.isInteger(priceSats) || priceSats <= 0) {
      throw new Error('Promo price must be a positive whole number of sats');
    }
    updateData.priceSats = priceSats;
  }
  if (data.maxUses !== undefined) {
    const maxUses = Number(data.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 0) {
      throw new Error('Max uses must be a non-negative whole number');
    }
    updateData.maxUses = maxUses;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }

  return prisma.storePromoCode.update({
    where: { id: promoId },
    data: updateData,
  });
}

export async function previewPromoCode(productId: string, rawCode?: string | null) {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return null;

  const promo = await prisma.storePromoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive || promo.productId !== productId) {
    throw new Error('Promo code is not valid for this item');
  }
  if (promo.uses >= promo.maxUses) {
    throw new Error('Promo code has already been used up');
  }

  return {
    id: promo.id,
    code: promo.code,
    priceSats: promo.priceSats,
    usesRemaining: Math.max(0, promo.maxUses - promo.uses),
  };
}

export async function createStoreOrder(userId: string, data: { productId: string; variantId: string; promoCode?: string | null }) {
  await ensureDefaultStore();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, lightningBalanceSats: true },
    });
    if (!user) throw new Error('User not found');

    const product = await tx.storeProduct.findUnique({
      where: { id: data.productId },
      select: { id: true, name: true, priceSats: true, isActive: true },
    });
    if (!product || !product.isActive) throw new Error('Item is not available');

    const variant = await tx.storeProductVariant.findUnique({
      where: { id: data.variantId },
      select: { id: true, productId: true, size: true, quantityAvailable: true },
    });
    if (!variant || variant.productId !== product.id) throw new Error('Selected size is not available');
    if (variant.quantityAvailable <= 0) throw new Error('Selected size is sold out');

    let finalPriceSats = product.priceSats;
    let promoId: string | null = null;
    const code = data.promoCode?.trim().toUpperCase();
    if (code) {
      const promo = await tx.storePromoCode.findUnique({ where: { code } });
      if (!promo || !promo.isActive || promo.productId !== product.id) {
        throw new Error('Promo code is not valid for this item');
      }
      if (promo.uses >= promo.maxUses) {
        throw new Error('Promo code has already been used up');
      }

      const promoClaim = await tx.storePromoCode.updateMany({
        where: { id: promo.id, isActive: true, uses: { lt: promo.maxUses } },
        data: { uses: { increment: 1 } },
      });
      if (promoClaim.count !== 1) {
        throw new Error('Promo code has already been used up');
      }

      finalPriceSats = promo.priceSats;
      promoId = promo.id;
    }

    if (user.lightningBalanceSats < finalPriceSats) {
      throw new Error(`Insufficient balance. Deposit ${finalPriceSats - user.lightningBalanceSats} more sats to buy this item.`);
    }

    const variantClaim = await tx.storeProductVariant.updateMany({
      where: { id: variant.id, quantityAvailable: { gt: 0 } },
      data: { quantityAvailable: { decrement: 1 } },
    });
    if (variantClaim.count !== 1) {
      throw new Error('Selected size is sold out');
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { lightningBalanceSats: { decrement: finalPriceSats } },
      select: { lightningBalanceSats: true },
    });

    const order = await tx.storeOrder.create({
      data: {
        userId,
        productId: product.id,
        variantId: variant.id,
        promoCodeId: promoId,
        quantity: 1,
        pricePaidSats: finalPriceSats,
        status: 'PAID',
      },
      include: {
        product: { select: { name: true } },
        variant: { select: { size: true } },
        promoCode: { select: { code: true } },
      },
    });

    await tx.balanceTransaction.create({
      data: {
        userId,
        type: 'STORE_PURCHASE',
        amountSats: finalPriceSats,
        note: `Store purchase: ${product.name} (${variant.size})`,
        balanceAfter: updatedUser.lightningBalanceSats,
      },
    });

    return { order, balanceSats: updatedUser.lightningBalanceSats };
  });
}

export async function getMyStoreOrders(userId: string) {
  return prisma.storeOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, size: true } },
      promoCode: { select: { code: true } },
    },
  });
}
