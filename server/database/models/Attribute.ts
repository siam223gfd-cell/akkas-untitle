import mongoose, { Document, Schema } from 'mongoose';

export type AttributeInputType =
  | 'color_swatch'
  | 'size_selector'
  | 'select'
  | 'radio'
  | 'text'
  | 'number'
  | 'boolean';

export interface IAttributeValue {
  label: string;
  value: string;
  hexColor?: string;
  description?: string;
}

export interface IAttribute extends Document {
  name: string;
  slug: string;
  type: AttributeInputType;
  values: IAttributeValue[];
  categories: string[]; // Category names or slugs
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleOnPDP: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttributeValueSchema = new Schema<IAttributeValue>(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    hexColor: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const AttributeSchema = new Schema<IAttribute>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: {
      type: String,
      enum: ['color_swatch', 'size_selector', 'select', 'radio', 'text', 'number', 'boolean'],
      default: 'select',
    },
    values: [AttributeValueSchema],
    categories: [{ type: String, trim: true }],
    isRequired: { type: Boolean, default: false },
    isFilterable: { type: Boolean, default: true },
    isVisibleOnPDP: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AttributeSchema.index({ slug: 1 });
AttributeSchema.index({ categories: 1 });

export const AttributeModel =
  mongoose.models.Attribute || mongoose.model<IAttribute>('Attribute', AttributeSchema);
