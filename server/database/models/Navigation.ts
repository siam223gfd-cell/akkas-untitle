import mongoose, { Document, Schema } from 'mongoose';

export interface INavigationItem extends Document {
  label: string;
  url: string;
  icon?: string;
  type: 'link' | 'dropdown' | 'category' | 'page';
  parentId: mongoose.Types.ObjectId | null;
  displayOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  badge?: string;
  badgeColor?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NavigationItemSchema = new Schema<INavigationItem>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    url: { type: String, required: true, trim: true },
    icon: { type: String, default: '', trim: true },
    type: {
      type: String,
      enum: ['link', 'dropdown', 'category', 'page'],
      default: 'link',
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'NavigationItem',
      default: null,
      index: true,
    },
    displayOrder: { type: Number, default: 1, index: true },
    isActive: { type: Boolean, default: true, index: true },
    openInNewTab: { type: Boolean, default: false },
    badge: { type: String, default: '', trim: true, maxlength: 20 },
    badgeColor: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true, maxlength: 150 },
  },
  { timestamps: true }
);

NavigationItemSchema.index({ parentId: 1, displayOrder: 1 });
NavigationItemSchema.index({ isActive: 1, displayOrder: 1 });

export const NavigationModel =
  mongoose.models.NavigationItem ||
  mongoose.model<INavigationItem>('NavigationItem', NavigationItemSchema);
