import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'customer'
  | 'super_admin'
  | 'admin'
  | 'order_manager'
  | 'inventory_manager'
  | 'catalog_manager'
  | 'customer_support'
  | 'finance';

export interface IUserAddress {
  _id?: string;
  id?: string;
  isDefault?: boolean;
  label?: string;
  recipientName: string;
  phone: string;
  division: string;
  divisionId?: string | number;
  district: string;
  districtId?: string | number;
  upazila: string;
  upazilaId?: string | number;
  unionOrWard?: string;
  unionId?: string | number;
  locality?: string;
  house?: string;
  road?: string;
  postalCode?: string;
  streetAddress: string;
  deliveryInstructions?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  normalizedEmail?: string;
  password?: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  providers: string[];
  googleId?: string;
  facebookId?: string;
  emailVerified: boolean;
  lastLoginAt?: Date;
  addresses: IUserAddress[];
  wishlist: mongoose.Types.ObjectId[];
  cart: {
    productId: string;
    variantId?: string;
    quantity: number;
    options?: Record<string, string>;
  }[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AddressSchema = new Schema<IUserAddress>({
  isDefault: { type: Boolean, default: false },
  label: { type: String, default: 'Home' },
  recipientName: { type: String, required: true },
  phone: { type: String, required: true },
  division: { type: String, required: true },
  divisionId: { type: Schema.Types.Mixed },
  district: { type: String, required: true },
  districtId: { type: Schema.Types.Mixed },
  upazila: { type: String, required: true },
  upazilaId: { type: Schema.Types.Mixed },
  unionOrWard: { type: String, default: '' },
  unionId: { type: Schema.Types.Mixed },
  locality: { type: String, default: '' },
  house: { type: String, default: '' },
  road: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  streetAddress: { type: String, required: true },
  deliveryInstructions: { type: String, default: '' },
});

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    normalizedEmail: { type: String, lowercase: true, trim: true, index: true },
    password: { type: String, required: false },
    role: {
      type: String,
      enum: [
        'customer',
        'super_admin',
        'admin',
        'order_manager',
        'inventory_manager',
        'catalog_manager',
        'customer_support',
        'finance',
      ],
      default: 'customer',
    },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    providers: { type: [String], default: ['email'] },
    googleId: { type: String, sparse: true, index: true },
    facebookId: { type: String, sparse: true, index: true },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: Date.now },
    addresses: [AddressSchema],
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product', default: [] }],
    cart: [
      {
        productId: { type: String, required: true },
        variantId: { type: String },
        quantity: { type: Number, required: true, default: 1 },
        options: { type: Schema.Types.Mixed },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.pre<IUser>('save', async function () {
  if (this.email) {
    this.normalizedEmail = this.email.toLowerCase().trim();
  }
  if (!this.isModified('password') || !this.password) return;
  // Prevent double-hashing if password is already a valid bcrypt hash
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password || !candidatePassword) return false;
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    if (isMatch) return true;
  } catch {
    // Gracefully handle malformed hash
  }
  // Safe backward compatibility for legacy plaintext during migration
  if (this.password === candidatePassword) {
    return true;
  }
  return false;
};

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

