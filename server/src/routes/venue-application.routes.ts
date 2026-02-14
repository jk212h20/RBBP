import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import * as venueAppService from '../services/venue-application.service';

const router = Router();

// POST /api/venue-applications - Submit a new venue application (authenticated users)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, address, description, imageUrl, phone, email, contactName, contactEmail, contactPhone } = req.body;

    if (!name || !address || !contactName) {
      res.status(400).json({ error: 'Name, address, and contact name are required' });
      return;
    }

    const application = await venueAppService.submitApplication({
      name,
      address,
      description,
      imageUrl: imageUrl || null,
      phone,
      email,
      contactName,
      contactEmail,
      contactPhone,
      submittedById: req.user!.userId,
    });

    res.status(201).json(application);
  } catch (error) {
    console.error('Error submitting venue application:', error);
    res.status(500).json({ error: 'Failed to submit venue application' });
  }
});

// GET /api/venue-applications/mine - Get my applications (authenticated users)
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const applications = await venueAppService.getMyApplications(req.user!.userId);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching my applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/venue-applications/pending-count - Get count of pending (admin)
router.get('/pending-count', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = await venueAppService.getPendingCount();
    res.json({ count });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
});

// GET /api/venue-applications - Get all applications (admin, optional ?status= filter)
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const applications = await venueAppService.getAllApplications(status);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/venue-applications/:id - Get single application (admin)
router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const application = await venueAppService.getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// POST /api/venue-applications/:id/approve - Approve application (admin)
router.post('/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await venueAppService.approveApplication(req.params.id, req.user!.userId);
    res.json(result);
  } catch (error: any) {
    console.error('Error approving application:', error);
    if (error.message === 'Application not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Application has already been reviewed') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

// POST /api/venue-applications/:id/reject - Reject application (admin)
router.post('/:id/reject', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    const application = await venueAppService.rejectApplication(req.params.id, req.user!.userId, rejectionReason);
    res.json(application);
  } catch (error: any) {
    console.error('Error rejecting application:', error);
    if (error.message === 'Application not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message === 'Application has already been reviewed') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// DELETE /api/venue-applications/:id - Delete application (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await venueAppService.deleteApplication(req.params.id);
    res.json({ message: 'Application deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    console.error('Error deleting application:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

export default router;
