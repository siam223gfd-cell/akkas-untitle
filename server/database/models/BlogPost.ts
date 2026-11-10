import mongoose, { Document, Schema } from 'mongoose';

export interface IBlogPost extends Document {
  title: string;
  slug: string;
  summary: string;
  content: string;
  author: string;
  image: string;
  tags: string[];
  publishedAt: Date;
  isActive: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, default: 'Aurelia Editorial' },
    image: { type: String, default: '' },
    tags: [{ type: String }],
    publishedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const BlogPostModel = mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);
