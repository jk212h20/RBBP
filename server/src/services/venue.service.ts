import prisma from '../lib/prisma';
import { CreateVenueInput, UpdateVenueInput } from '../validators/venue.validator';

export class VenueService {
  /**
   * Get all venues
   */
  async getAllVenues(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    
    return prisma.venue.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get venue by ID
   */
  async getVenueById(id: string) {
    return prisma.venue.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        events: {
          where: {
            dateTime: {
              gte: new Date(),
            },
          },
          orderBy: {
            dateTime: 'asc',
          },
          take: 5,
          include: {
            _count: {
              select: {
                signups: true,
              },
            },
          },
        },
        _count: {
          select: {
            events: true,
          },
        },
      },
    });
  }

  /**
   * Create a new venue
   */
  async createVenue(data: CreateVenueInput, managerId?: string) {
    return prisma.venue.create({
      data: {
        name: data.name,
        address: data.address,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        phone: data.phone || null,
        email: data.email || null,
        managerId: managerId || null,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update a venue
   */
  async updateVenue(id: string, data: UpdateVenueInput) {
    return prisma.venue.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.address && { address: data.address }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Delete a venue (soft delete by setting isActive to false)
   */
  async deleteVenue(id: string) {
    return prisma.venue.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete a venue (only if no events)
   */
  async hardDeleteVenue(id: string) {
    // Check if venue has events
    const eventCount = await prisma.event.count({
      where: { venueId: id },
    });

    if (eventCount > 0) {
      throw new Error('Cannot delete venue with existing events. Use soft delete instead.');
    }

    return prisma.venue.delete({
      where: { id },
    });
  }

  /**
   * Assign a manager to a venue
   * Also upgrades the user to VENUE_MANAGER role if they aren't already a VENUE_MANAGER, TOURNAMENT_DIRECTOR, or ADMIN
   */
  async assignManager(venueId: string, managerId: string | null) {
    // If assigning a manager (not removing), upgrade their role if needed
    if (managerId) {
      const user = await prisma.user.findUnique({
        where: { id: managerId },
        select: { id: true, role: true }
      });
      
      // Upgrade to VENUE_MANAGER if they're just a PLAYER
      if (user && user.role === 'PLAYER') {
        await prisma.user.update({
          where: { id: managerId },
          data: { role: 'VENUE_MANAGER' }
        });
      }
    }
    
    return prisma.venue.update({
      where: { id: venueId },
      data: { managerId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get venues managed by a specific user
   */
  async getVenuesByManager(managerId: string) {
    return prisma.venue.findMany({
      where: {
        managerId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}

export const venueService = new VenueService();
