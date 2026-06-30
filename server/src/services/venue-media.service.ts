import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';

function validateVenueMediaImage(imageUrl: unknown) {
  const normalized = String(imageUrl || '').trim();
  if (!normalized) throw new Error('Image is required');
  if (normalized.length > 2_500_000) throw new Error('Image is too large. Please upload a smaller image.');
  if (!normalized.startsWith('data:image/') && !/^https?:\/\//i.test(normalized)) {
    throw new Error('Image must be an uploaded image or valid image URL');
  }
  return normalized;
}

async function assertVenueMediaAccess(venueId: string, userId: string, role: UserRole) {
  if (role === UserRole.ADMIN) return;
  if (role !== UserRole.VENUE_MANAGER) throw new Error('Not authorized');

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { managerId: true } });
  if (!venue || venue.managerId !== userId) throw new Error('You can only manage media for venues assigned to you');
}

async function assertMediaAccess(mediaId: string, userId: string, role: UserRole) {
  const media = await prisma.venueMedia.findUnique({ where: { id: mediaId }, select: { venueId: true } });
  if (!media) throw new Error('Media not found');
  await assertVenueMediaAccess(media.venueId, userId, role);
  return media;
}

export async function listVenueMedia(venueId: string) {
  return prisma.venueMedia.findMany({
    where: { venueId },
    orderBy: [{ isMenu: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createVenueMedia(
  venueId: string,
  userId: string,
  role: UserRole,
  data: { imageUrl?: string; caption?: string | null; isMenu?: boolean; sortOrder?: number }
) {
  await assertVenueMediaAccess(venueId, userId, role);
  const imageUrl = validateVenueMediaImage(data.imageUrl);
  const count = await prisma.venueMedia.count({ where: { venueId } });

  return prisma.venueMedia.create({
    data: {
      venueId,
      imageUrl,
      caption: data.caption ? String(data.caption).trim() : null,
      isMenu: Boolean(data.isMenu),
      sortOrder: Number.isInteger(Number(data.sortOrder)) ? Number(data.sortOrder) : count + 1,
    },
  });
}

export async function updateVenueMedia(
  mediaId: string,
  userId: string,
  role: UserRole,
  data: { imageUrl?: string; caption?: string | null; isMenu?: boolean; sortOrder?: number }
) {
  await assertMediaAccess(mediaId, userId, role);

  const updateData: { imageUrl?: string; caption?: string | null; isMenu?: boolean; sortOrder?: number } = {};
  if (data.imageUrl !== undefined) updateData.imageUrl = validateVenueMediaImage(data.imageUrl);
  if (data.caption !== undefined) updateData.caption = data.caption ? String(data.caption).trim() : null;
  if (data.isMenu !== undefined) updateData.isMenu = Boolean(data.isMenu);
  if (data.sortOrder !== undefined) {
    const sortOrder = Number(data.sortOrder);
    if (!Number.isInteger(sortOrder)) throw new Error('Sort order must be a whole number');
    updateData.sortOrder = sortOrder;
  }

  return prisma.venueMedia.update({ where: { id: mediaId }, data: updateData });
}

export async function deleteVenueMedia(mediaId: string, userId: string, role: UserRole) {
  await assertMediaAccess(mediaId, userId, role);
  await prisma.venueMedia.delete({ where: { id: mediaId } });
  return { success: true };
}
