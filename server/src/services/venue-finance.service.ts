import { UserRole, VenueInvoiceStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { createInvoice, lookupInvoice } from './voltage.service';

const VENUE_INVOICE_EXPIRY_SECONDS = parseInt(process.env.VENUE_INVOICE_EXPIRY_SECONDS || '604800', 10); // 7 days

function parsePositiveSats(value: unknown, label = 'Amount') {
  const sats = Number(value);
  if (!Number.isInteger(sats) || sats <= 0) {
    throw new Error(`${label} must be a positive whole number of sats`);
  }
  return sats;
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Invalid due date');
  return date;
}

function getInvoiceIncludes() {
  return {
    venue: { select: { id: true, name: true, managerId: true, address: true } },
    manager: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    ledgerTransactions: { orderBy: { createdAt: 'desc' as const } },
  };
}

async function assertVenueManagerAccess(userId: string, role: UserRole, venueId: string) {
  if (role === UserRole.ADMIN) return;
  if (role !== UserRole.VENUE_MANAGER) throw new Error('Not authorized');

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { managerId: true } });
  if (!venue || venue.managerId !== userId) throw new Error('Not authorized for this venue');
}

export async function createVenueInvoice(adminUserId: string, data: { venueId?: string; amountSats?: number; memo?: string; internalNote?: string | null; dueAt?: string | null }) {
  const venueId = String(data.venueId || '').trim();
  if (!venueId) throw new Error('Venue is required');

  const amountSats = parsePositiveSats(data.amountSats);
  const memo = String(data.memo || '').trim();
  if (!memo) throw new Error('Memo/reason is required');
  const internalNote = data.internalNote ? String(data.internalNote).trim() : null;
  const dueAt = parseOptionalDate(data.dueAt);

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, name: true, managerId: true } });
  if (!venue) throw new Error('Venue not found');

  const invoice = await createInvoice(amountSats, `RBBP Venue Bill: ${venue.name} - ${memo}`, VENUE_INVOICE_EXPIRY_SECONDS);

  return prisma.venueInvoice.create({
    data: {
      venueId: venue.id,
      managerId: venue.managerId,
      createdById: adminUserId,
      amountSats,
      memo,
      internalNote,
      dueAt,
      status: VenueInvoiceStatus.PENDING,
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      expiresAt: new Date(Date.now() + VENUE_INVOICE_EXPIRY_SECONDS * 1000),
    },
    include: getInvoiceIncludes(),
  });
}

export async function listAdminVenueInvoices(filters: { status?: string; venueId?: string }) {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.venueId) where.venueId = filters.venueId;

  return prisma.venueInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: getInvoiceIncludes(),
    take: 200,
  });
}

export async function listMyVenueInvoices(userId: string) {
  return prisma.venueInvoice.findMany({
    where: {
      venue: { managerId: userId },
    },
    orderBy: { createdAt: 'desc' },
    include: getInvoiceIncludes(),
    take: 200,
  });
}

export async function getVenueInvoiceForUser(invoiceId: string, userId: string, role: UserRole) {
  const invoice = await prisma.venueInvoice.findUnique({
    where: { id: invoiceId },
    include: getInvoiceIncludes(),
  });
  if (!invoice) throw new Error('Invoice not found');

  await assertVenueManagerAccess(userId, role, invoice.venueId);
  return invoice;
}

export async function checkVenueInvoicePayment(invoiceId: string, userId: string, role: UserRole) {
  const invoice = await prisma.venueInvoice.findUnique({ where: { id: invoiceId }, include: { venue: { select: { managerId: true } } } });
  if (!invoice) throw new Error('Invoice not found');
  await assertVenueManagerAccess(userId, role, invoice.venueId);

  if (invoice.status !== VenueInvoiceStatus.PENDING) {
    return getVenueInvoiceForUser(invoice.id, userId, role);
  }

  let lookupSucceeded = false;
  let settled = false;
  if (invoice.paymentHash) {
    try {
      const lookup = await lookupInvoice(invoice.paymentHash);
      lookupSucceeded = true;
      settled = lookup.settled && lookup.amountPaidSats >= invoice.amountSats;
    } catch (error) {
      console.error(`[VenueFinance] Invoice lookup failed for ${invoice.id}:`, error);
    }
  }

  if (settled) {
    await settleVenueInvoice(invoice.id);
  } else if (lookupSucceeded && invoice.expiresAt && invoice.expiresAt < new Date()) {
    await prisma.venueInvoice.update({
      where: { id: invoice.id },
      data: { status: VenueInvoiceStatus.EXPIRED },
    });
  }

  return getVenueInvoiceForUser(invoice.id, userId, role);
}

export async function settleVenueInvoice(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.venueInvoice.updateMany({
      where: { id: invoiceId, status: VenueInvoiceStatus.PENDING },
      data: { status: VenueInvoiceStatus.PAID, paidAt: new Date() },
    });

    const invoice = await tx.venueInvoice.findUnique({
      where: { id: invoiceId },
      include: getInvoiceIncludes(),
    });
    if (!invoice) throw new Error('Invoice not found');

    if (claim.count === 1) {
      await tx.venueLedgerTransaction.create({
        data: {
          venueId: invoice.venueId,
          invoiceId: invoice.id,
          userId: invoice.managerId || invoice.createdById,
          amountSats: invoice.amountSats,
          type: 'INVOICE_PAID',
          reason: invoice.memo,
        },
      });
    }

    return invoice;
  });
}

export async function cancelVenueInvoice(invoiceId: string, adminUserId: string, status: 'CANCELLED' | 'WAIVED' = 'CANCELLED') {
  const targetStatus = status === 'WAIVED' ? VenueInvoiceStatus.WAIVED : VenueInvoiceStatus.CANCELLED;
  const invoice = await prisma.venueInvoice.update({
    where: { id: invoiceId },
    data: {
      status: targetStatus,
      cancelledAt: targetStatus === VenueInvoiceStatus.CANCELLED ? new Date() : undefined,
      waivedAt: targetStatus === VenueInvoiceStatus.WAIVED ? new Date() : undefined,
    },
    include: getInvoiceIncludes(),
  });

  await prisma.venueLedgerTransaction.create({
    data: {
      venueId: invoice.venueId,
      invoiceId: invoice.id,
      userId: adminUserId,
      amountSats: 0,
      type: targetStatus,
      reason: invoice.memo,
    },
  });

  return invoice;
}

export async function regenerateVenueInvoice(invoiceId: string, adminUserId: string) {
  const existing = await prisma.venueInvoice.findUnique({
    where: { id: invoiceId },
    include: { venue: { select: { name: true } } },
  });
  if (!existing) throw new Error('Invoice not found');
  const regeneratableStatuses: VenueInvoiceStatus[] = [VenueInvoiceStatus.PENDING, VenueInvoiceStatus.EXPIRED, VenueInvoiceStatus.FAILED];
  if (!regeneratableStatuses.includes(existing.status)) {
    throw new Error('Only pending, expired, or failed invoices can be regenerated');
  }

  const invoice = await createInvoice(existing.amountSats, `RBBP Venue Bill: ${existing.venue.name} - ${existing.memo}`, VENUE_INVOICE_EXPIRY_SECONDS);
  const updated = await prisma.venueInvoice.update({
    where: { id: existing.id },
    data: {
      status: VenueInvoiceStatus.PENDING,
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      expiresAt: new Date(Date.now() + VENUE_INVOICE_EXPIRY_SECONDS * 1000),
      cancelledAt: null,
      waivedAt: null,
    },
    include: getInvoiceIncludes(),
  });

  await prisma.venueLedgerTransaction.create({
    data: {
      venueId: updated.venueId,
      invoiceId: updated.id,
      userId: adminUserId,
      amountSats: 0,
      type: 'REGENERATED',
      reason: updated.memo,
    },
  });

  return updated;
}

export async function checkPendingVenueInvoices() {
  const invoices = await prisma.venueInvoice.findMany({
    where: { status: VenueInvoiceStatus.PENDING, paymentHash: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  for (const invoice of invoices) {
    try {
      let lookupSucceeded = false;
      let settled = false;
      if (invoice.paymentHash) {
        const lookup = await lookupInvoice(invoice.paymentHash);
        lookupSucceeded = true;
        settled = lookup.settled && lookup.amountPaidSats >= invoice.amountSats;
      }

      if (settled) {
        await settleVenueInvoice(invoice.id);
      } else if (lookupSucceeded && invoice.expiresAt && invoice.expiresAt < new Date()) {
        await prisma.venueInvoice.update({ where: { id: invoice.id }, data: { status: VenueInvoiceStatus.EXPIRED } });
      }
    } catch (error) {
      console.error(`[VenueFinance] Failed to check pending invoice ${invoice.id}:`, error);
    }
  }
}
