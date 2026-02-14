import prisma from '../lib/prisma';

// Submit a new venue application (any authenticated user)
export async function submitApplication(data: {
  name: string;
  address: string;
  description?: string;
  imageUrl?: string | null;
  phone?: string;
  email?: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  submittedById: string;
}) {
  return prisma.venueApplication.create({
    data,
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

// Get all applications (admin) with optional status filter
export async function getAllApplications(status?: string) {
  const where: any = {};
  if (status) {
    where.status = status;
  }

  return prisma.venueApplication.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Get a single application by ID
export async function getApplicationById(id: string) {
  return prisma.venueApplication.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
    },
  });
}

// Get applications submitted by a specific user
export async function getMyApplications(userId: string) {
  return prisma.venueApplication.findMany({
    where: { submittedById: userId },
    include: {
      venue: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Approve an application - creates the venue and links it
export async function approveApplication(applicationId: string, reviewedById: string) {
  const application = await prisma.venueApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'PENDING') {
    throw new Error('Application has already been reviewed');
  }

  // Create the venue and update the application in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the venue from the application data
    const venue = await tx.venue.create({
      data: {
        name: application.name,
        address: application.address,
        description: application.description,
        imageUrl: application.imageUrl,
        phone: application.phone,
        email: application.email,
      },
    });

    // Update the application status
    const updatedApplication = await tx.venueApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
        venueId: venue.id,
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    return { application: updatedApplication, venue };
  });

  return result;
}

// Reject an application
export async function rejectApplication(
  applicationId: string,
  reviewedById: string,
  rejectionReason?: string
) {
  const application = await prisma.venueApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'PENDING') {
    throw new Error('Application has already been reviewed');
  }

  return prisma.venueApplication.update({
    where: { id: applicationId },
    data: {
      status: 'REJECTED',
      reviewedById,
      reviewedAt: new Date(),
      rejectionReason,
    },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });
}

// Delete an application (admin only)
export async function deleteApplication(applicationId: string) {
  return prisma.venueApplication.delete({
    where: { id: applicationId },
  });
}

// Get count of pending applications (for admin badge)
export async function getPendingCount() {
  return prisma.venueApplication.count({
    where: { status: 'PENDING' },
  });
}
