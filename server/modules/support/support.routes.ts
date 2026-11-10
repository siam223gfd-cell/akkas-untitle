import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SupportEnquiryModel } from '../../database/models/SupportEnquiry';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';

export const supportRouter = Router();

supportRouter.use(requireDatabase);

const supportEnquirySchema = z.object({
  name: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Please provide a valid email address'),
  phone: z.string().trim().optional(),
  subject: z.string().trim().min(2, 'Subject is required'),
  message: z.string().trim().min(5, 'Message must be at least 5 characters'),
});

// POST /api/support (Public contact submission)
supportRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = supportEnquirySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'All required fields must be completed cleanly.',
      });
    }

    const enquiry = await SupportEnquiryModel.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || '',
      subject: parsed.data.subject,
      message: parsed.data.message,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your enquiry has been received. Our support team will reach out shortly.',
      enquiryId: enquiry._id,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/support (Admin list enquiries)
supportRouter.get(
  '/',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const enquiries = await SupportEnquiryModel.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, enquiries });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
