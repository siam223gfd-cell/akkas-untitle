import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportEnquiry extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  staffNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportEnquirySchema = new Schema<ISupportEnquiry>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new' },
    staffNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SupportEnquiryModel =
  mongoose.models.SupportEnquiry || mongoose.model<ISupportEnquiry>('SupportEnquiry', SupportEnquirySchema);
