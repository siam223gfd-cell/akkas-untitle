import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@novaracommerce.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',
  jwtSecret: process.env.JWT_SECRET || 'novara_commerce_default_super_secret_jwt_key_2026',
  jwtExpiresIn: '7d',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'orders@novaracommerce.com',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
  },
  appUrl: process.env.APP_URL || '',
  payments: {
    bkash: {
      baseUrl: (process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout').replace(/\/+$/, ''),
      appKey: process.env.BKASH_APP_KEY || '',
      appSecret: process.env.BKASH_APP_SECRET || '',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
      isConfigured: !!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET),
    },
    nagad: {
      baseUrl: (process.env.NAGAD_BASE_URL || 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs').replace(/\/+$/, ''),
      merchantId: process.env.NAGAD_MERCHANT_ID || '',
      merchantNumber: process.env.NAGAD_MERCHANT_NUMBER || '',
      privateKey: process.env.NAGAD_PRIVATE_KEY || '',
      publicKey: process.env.NAGAD_PUBLIC_KEY || '',
      isConfigured: !!(process.env.NAGAD_MERCHANT_ID && (process.env.NAGAD_PRIVATE_KEY || process.env.NAGAD_MERCHANT_NUMBER)),
    },
    sslcommerz: {
      baseUrl: process.env.SSLCOMMERZ_IS_SANDBOX === 'false'
        ? 'https://securepay.sslcommerz.com'
        : 'https://sandbox.sslcommerz.com',
      storeId: process.env.SSLCOMMERZ_STORE_ID || '',
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
      isSandbox: process.env.SSLCOMMERZ_IS_SANDBOX !== 'false',
      isConfigured: !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
    },
  },
};

/**
 * Validates that production environments supply a valid MONGODB_URI.
 */
export function validateEnvironment(): void {
  if (config.env === 'production') {
    if (!config.mongodbUri) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: MONGODB_URI environment variable is not defined. ' +
        'A valid MongoDB Atlas connection string is required in production environments.'
      );
    }
    if (config.mongodbUri.includes('YOUR_PASSWORD') || config.mongodbUri.includes('YOUR_USERNAME')) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: MONGODB_URI contains unconfigured placeholder credentials. ' +
        'Please supply your real MongoDB Atlas connection string.'
      );
    }
  }
}
