import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config/env';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';

export const uploadRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/upload (Permanent file upload from device)
uploadRouter.post(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager', 'order_manager', 'inventory_manager', 'customer_support', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawData = req.body.data || req.body.dataUri;
      const { filename = 'image', folder = 'media' } = req.body;

      if (!rawData || typeof rawData !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'No image data provided. Please provide a base64 encoded data URI.',
        });
      }

      // Check format: data:image/png;base64,...
      const match = rawData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image format. Expected data URI starting with data:image/...;base64,',
        });
      }

      const mimeType = match[1].toLowerCase();
      const base64Data = match[2];

      const ext = ALLOWED_MIME_TYPES[mimeType];
      if (!ext) {
        return res.status(400).json({
          success: false,
          message: `Unsupported file type: ${mimeType}. Allowed formats are JPEG, PNG, WEBP, GIF, and SVG.`,
        });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded image data is empty or invalid.',
        });
      }
      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the 5MB limit (Size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`,
        });
      }

      if (mimeType === 'image/svg+xml') {
        const svgContent = buffer.toString('utf8');
        if (/<script[\s>]|on[a-z]+\s*=|javascript:|<foreignObject|data:text\/html/i.test(svgContent)) {
          return res.status(400).json({
            success: false,
            message: 'SVG contains active scripts or unsafe attributes and was rejected.',
          });
        }
      }

      const sanitizedBase = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'image';
      const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const savedFileName = `${sanitizedBase}_${uniqueSuffix}${ext}`;
      const targetFilePath = path.join(UPLOADS_DIR, savedFileName);

      await fs.promises.writeFile(targetFilePath, buffer);

      const publicUrl = `/uploads/${savedFileName}`;

      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        url: publicUrl,
        filename: savedFileName,
        size: buffer.length,
        mimeType,
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      res.status(500).json({ success: false, message: err.message || 'File upload failed' });
    }
  }
);

// POST /api/upload/sign (Generates Cloudinary signature if configured)
uploadRouter.post(
  '/sign',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { folder = 'novara_media' } = req.body;

      if (!config.cloudinary.cloudName || !config.cloudinary.apiKey) {
        return res.json({
          success: true,
          isConfigured: false,
          cloudName: 'novara-cloud',
          message: 'Cloudinary environment variables not configured. Falling back to local permanent storage.',
        });
      }

      const timestamp = Math.round(new Date().getTime() / 1000);

      res.json({
        success: true,
        isConfigured: true,
        cloudName: config.cloudinary.cloudName,
        apiKey: config.cloudinary.apiKey,
        timestamp,
        folder,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
