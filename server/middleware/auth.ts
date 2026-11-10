import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { UserModel, UserRole } from '../database/models/User';
import { isDatabaseConnected } from '../database/connection';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  accountDeactivated?: boolean;
}

function parseCookies(cookieHeader?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const rawCookie of cookieHeader.split(';')) {
    const trimmed = rawCookie.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      map.set(key, decodeURIComponent(rawVal));
    } catch {
      map.set(key, rawVal);
    }
  }
  return map;
}

function isAdminPreferredRoute(req: Request): boolean {
  const path = req.path || '';
  if (
    path.startsWith('/api/admin') ||
    path.startsWith('/api/auth/admin') ||
    path.startsWith('/api/upload') ||
    path.startsWith('/api/hero-slides') ||
    path.startsWith('/api/banners') ||
    path.startsWith('/api/advertisements') ||
    path === '/api/reviews/admin' ||
    path === '/api/orders/stats'
  ) {
    return true;
  }
  if (
    path === '/api/orders' && req.method === 'GET'
  ) {
    return true;
  }
  if (path.startsWith('/api/orders/') && req.method === 'PATCH') {
    return true;
  }
  if (path === '/api/support' && req.method === 'GET') {
    return true;
  }
  if (path === '/api/coupons' && req.method === 'GET') {
    return true;
  }
  if (path.startsWith('/api/products') && req.method === 'GET' && Boolean(req.query?.status)) {
    return true;
  }
  if (
    (path.startsWith('/api/products') ||
      path.startsWith('/api/categories') ||
      path.startsWith('/api/attributes') ||
      path.startsWith('/api/coupons') ||
      path.startsWith('/api/cms') ||
      path.startsWith('/api/reviews/')) &&
    req.method !== 'GET' &&
    path !== '/api/coupons/validate' &&
    path !== '/api/cms/newsletter'
  ) {
    return true;
  }
  return false;
}

const STAFF_ROLES = new Set([
  'super_admin',
  'admin',
  'order_manager',
  'inventory_manager',
  'catalog_manager',
  'customer_support',
  'finance',
]);

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const cookies = req.headers.cookie ? parseCookies(req.headers.cookie) : new Map<string, string>();
  const adminCookie = cookies.get('admin_token');
  const userCookie = cookies.get('token');

  let bearerToken: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim();
  }

  const isAdminRoute = isAdminPreferredRoute(req);
  const candidateTokens: string[] = [];

  if (isAdminRoute) {
    if (adminCookie) candidateTokens.push(adminCookie);
    if (bearerToken && !candidateTokens.includes(bearerToken)) candidateTokens.push(bearerToken);
    if (userCookie && !candidateTokens.includes(userCookie)) candidateTokens.push(userCookie);
  } else {
    if (bearerToken) candidateTokens.push(bearerToken);
    if (userCookie && !candidateTokens.includes(userCookie)) candidateTokens.push(userCookie);
    if (adminCookie && !candidateTokens.includes(adminCookie)) candidateTokens.push(adminCookie);
  }

  for (const token of candidateTokens) {
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
      if (!decoded || !decoded.id) continue;

      // If accessing admin route and decoded token is for customer, skip if other admin token candidate exists
      if (isAdminRoute && decoded.role === 'customer' && candidateTokens.length > 1 && token !== adminCookie && adminCookie) {
        continue;
      }

      if (isDatabaseConnected() && mongoose.Types.ObjectId.isValid(decoded.id)) {
        const dbUser = await UserModel.findById(decoded.id).select('name email role isActive').lean();
        if (!dbUser) continue;
        if (dbUser.isActive === false) {
          req.accountDeactivated = true;
          return next();
        }
        req.user = {
          id: dbUser._id.toString(),
          email: dbUser.email,
          role: dbUser.role,
          name: dbUser.name,
        };
        return next();
      } else {
        req.user = decoded;
        return next();
      }
    } catch {
      // Invalid/expired candidate — continue trying next candidate
      continue;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.accountDeactivated) {
    return res.status(403).json({
      success: false,
      message: 'This account has been deactivated. Please contact an administrator.',
    });
  }
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to proceed.',
    });
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.accountDeactivated) {
      return res.status(403).json({
        success: false,
        message: 'This administrative staff account has been deactivated.',
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (req.user.role === 'super_admin') {
      return next(); // Super admin has full access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. You need one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
