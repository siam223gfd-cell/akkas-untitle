import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { NavigationModel, INavigationItem } from '../../database/models/Navigation';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { logAuditActivity } from '../../utils/auditLogger';
import { initialNavigation } from '../../seeds/defaultData';

export const navigationRouter = Router();

// In-memory public cache for high-throughput navigation delivery
let cachedPublicNavigationTree: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute TTL fallback

export function invalidateNavigationCache(): void {
  cachedPublicNavigationTree = null;
  cacheTimestamp = 0;
}

// URL format validation helper
function isValidNavUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) return true;
  if (/^(mailto|tel):[^\s]+$/i.test(trimmed)) return true;
  return false;
}

// Recursively build hierarchical navigation tree
function buildNavigationTree(items: any[], parentId: string | null = null, currentDepth = 1): any[] {
  if (currentDepth > 4) return []; // Guard against deep recursion

  const directChildren = items
    .filter((item) => {
      const pId = item.parentId ? item.parentId.toString() : null;
      return pId === parentId;
    })
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return directChildren.map((item) => {
    const raw = item.toObject ? item.toObject() : item;
    const children = buildNavigationTree(items, raw._id.toString(), currentDepth + 1);
    return {
      ...raw,
      id: raw._id.toString(),
      children: children.length > 0 ? children : undefined,
    };
  });
}

// Helper to check for circular hierarchy
async function wouldCreateCircularHierarchy(itemId: string, candidateParentId: string): Promise<boolean> {
  if (itemId === candidateParentId) return true;

  let currentParentId: string | null = candidateParentId;
  const visited = new Set<string>([itemId]);

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return true;
    }
    visited.add(currentParentId);

    const parentDoc: any = await NavigationModel.findById(currentParentId).select('parentId').lean();
    if (!parentDoc || !parentDoc.parentId) {
      break;
    }
    currentParentId = parentDoc.parentId.toString();
  }

  return false;
}

// Helper to calculate hierarchy depth
async function calculateItemDepth(parentId: string | null): Promise<number> {
  let depth = 1;
  let currentId = parentId;

  while (currentId) {
    depth++;
    const parentDoc: any = await NavigationModel.findById(currentId).select('parentId').lean();
    if (!parentDoc || !parentDoc.parentId) break;
    currentId = parentDoc.parentId.toString();
    if (depth > 10) break; // Infinite loop guard
  }

  return depth;
}

// Validation schema for Create / Update Navigation Menu
const navigationItemSchema = z.object({
  label: z.string().min(1, 'Label is required').max(60, 'Label cannot exceed 60 characters'),
  url: z.string().min(1, 'URL destination is required').refine(isValidNavUrl, {
    message: 'Invalid URL. Must be an internal path (starting with /) or a valid web address (http://, https://, tel:, mailto:)',
  }),
  icon: z.string().max(40).optional().default(''),
  type: z.enum(['link', 'dropdown', 'category', 'page']).optional().default('link'),
  parentId: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
  openInNewTab: z.boolean().optional().default(false),
  badge: z.string().max(20).optional().default(''),
  badgeColor: z.string().max(30).optional().default(''),
  description: z.string().max(150).optional().default(''),
});

/**
 * -------------------------------------------------------------
 * PUBLIC ENDPOINTS
 * -------------------------------------------------------------
 */

// GET /api/navigation or GET /api/navigation/public
// Returns active hierarchical navigation tree for the public store
navigationRouter.get(['/', '/public'], async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cachedPublicNavigationTree && now - cacheTimestamp < CACHE_TTL_MS) {
      return res.json({
        success: true,
        navigation: cachedPublicNavigationTree,
        cached: true,
      });
    }

    // Query active items sorted by displayOrder
    const activeItems = await NavigationModel.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // If database navigation is empty, automatically seed initial navigation items
    if (activeItems.length === 0) {
      const seeded = await NavigationModel.insertMany(initialNavigation);
      const seededTree = buildNavigationTree(seeded, null);
      cachedPublicNavigationTree = seededTree;
      cacheTimestamp = now;
      return res.json({
        success: true,
        navigation: seededTree,
        seeded: true,
      });
    }

    const tree = buildNavigationTree(activeItems, null);
    cachedPublicNavigationTree = tree;
    cacheTimestamp = now;

    res.json({
      success: true,
      navigation: tree,
      cached: false,
    });
  } catch (err: any) {
    // If database is disconnected or unreachable, return graceful fallback with defaults
    console.warn('[Navigation API Notice]:', err.message);
    res.json({
      success: true,
      navigation: initialNavigation.map((item, idx) => ({
        ...item,
        id: `default-${idx}`,
        _id: `default-${idx}`,
      })),
      fallback: true,
    });
  }
});

/**
 * -------------------------------------------------------------
 * ADMIN PROTECTED ENDPOINTS
 * -------------------------------------------------------------
 */

// Apply database guard & role requirement for all admin operations
const adminProtected = [
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
];

// GET /api/navigation/admin and /api/navigation/admin/all
// Returns all navigation items with parent-child metadata and children counts
navigationRouter.get(['/admin', '/admin/all'], ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allItems = await NavigationModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // If completely empty, auto-seed defaults
    if (allItems.length === 0) {
      const seeded = await NavigationModel.insertMany(initialNavigation);
      const seededTree = buildNavigationTree(seeded, null);
      invalidateNavigationCache();
      return res.json({
        success: true,
        items: seeded,
        tree: seededTree,
        seeded: true,
      });
    }

    // Build parent lookup map & count children
    const itemMap = new Map<string, any>();
    const childrenCountMap: Record<string, number> = {};

    allItems.forEach((item) => {
      itemMap.set(item._id.toString(), item);
      if (item.parentId) {
        const pId = item.parentId.toString();
        childrenCountMap[pId] = (childrenCountMap[pId] || 0) + 1;
      }
    });

    const enrichedItems = allItems.map((item) => {
      const parent = item.parentId ? itemMap.get(item.parentId.toString()) : null;
      return {
        ...item,
        id: item._id.toString(),
        parentLabel: parent ? parent.label : null,
        childrenCount: childrenCountMap[item._id.toString()] || 0,
      };
    });

    const tree = buildNavigationTree(allItems, null);

    res.json({
      success: true,
      items: enrichedItems,
      tree,
      totalCount: allItems.length,
      activeCount: allItems.filter((i) => i.isActive).length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/navigation
// Create a new navigation menu item
navigationRouter.post('/', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = navigationItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid navigation item data',
        errors: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    let validParentId: mongoose.Types.ObjectId | null = null;

    if (data.parentId && typeof data.parentId === 'string' && data.parentId.trim() !== '') {
      if (!mongoose.Types.ObjectId.isValid(data.parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent menu identifier.' });
      }

      const parentDoc = await NavigationModel.findById(data.parentId);
      if (!parentDoc) {
        return res.status(404).json({ success: false, message: 'Specified parent menu item does not exist.' });
      }

      const depth = await calculateItemDepth(data.parentId);
      if (depth >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Maximum navigation nesting depth (3 levels) reached. Cannot nest items deeper.',
        });
      }

      validParentId = new mongoose.Types.ObjectId(data.parentId);
    }

    // Determine default displayOrder if not explicitly specified
    let displayOrder = data.displayOrder;
    if (typeof displayOrder !== 'number') {
      const highestOrderDoc = await NavigationModel.findOne({ parentId: validParentId })
        .sort({ displayOrder: -1 })
        .select('displayOrder')
        .lean();
      displayOrder = highestOrderDoc ? (highestOrderDoc.displayOrder || 0) + 1 : 1;
    }

    const newMenuItem = await NavigationModel.create({
      label: data.label.trim(),
      url: data.url.trim(),
      icon: data.icon ? data.icon.trim() : '',
      type: data.type || (validParentId ? 'link' : 'link'),
      parentId: validParentId,
      displayOrder,
      isActive: data.isActive !== false,
      openInNewTab: !!data.openInNewTab,
      badge: data.badge ? data.badge.trim() : '',
      badgeColor: data.badgeColor ? data.badgeColor.trim() : '',
      description: data.description ? data.description.trim() : '',
    });

    invalidateNavigationCache();

    await logAuditActivity({
      action: 'CREATE_NAVIGATION_MENU',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Created navigation menu "${newMenuItem.label}" -> ${newMenuItem.url}`,
      recordId: newMenuItem._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Menu item "${newMenuItem.label}" created successfully.`,
      item: newMenuItem,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/navigation/reorder
// Reorder multiple menu items atomically
navigationRouter.put('/reorder', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payload must contain a non-empty array of items with { id, displayOrder }',
      });
    }

    const bulkOps = [];
    for (const item of items) {
      if (!item.id || typeof item.displayOrder !== 'number') continue;
      if (!mongoose.Types.ObjectId.isValid(item.id)) continue;

      const updateData: any = { displayOrder: item.displayOrder };
      if (item.parentId !== undefined) {
        updateData.parentId = item.parentId && mongoose.Types.ObjectId.isValid(item.parentId)
          ? new mongoose.Types.ObjectId(item.parentId)
          : null;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: updateData },
        },
      });
    }

    if (bulkOps.length > 0) {
      await NavigationModel.bulkWrite(bulkOps);
    }

    invalidateNavigationCache();

    await logAuditActivity({
      action: 'REORDER_NAVIGATION_MENUS',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Reordered ${bulkOps.length} navigation menu items.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Successfully updated display order for ${bulkOps.length} menu items.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/navigation/:id
// Update an existing navigation menu item
navigationRouter.put('/:id', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid navigation item identifier.' });
    }

    const parsed = navigationItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Invalid navigation item data',
        errors: parsed.error.flatten(),
      });
    }

    const existing = await NavigationModel.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Navigation menu item not found.' });
    }

    const data = parsed.data;
    let targetParentId: mongoose.Types.ObjectId | null = null;

    if (data.parentId && typeof data.parentId === 'string' && data.parentId.trim() !== '') {
      if (data.parentId === id) {
        return res.status(400).json({
          success: false,
          message: 'A navigation menu item cannot be set as its own parent.',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(data.parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent menu identifier.' });
      }

      // Check circular dependency
      const isCircular = await wouldCreateCircularHierarchy(id, data.parentId);
      if (isCircular) {
        return res.status(400).json({
          success: false,
          message: 'Circular hierarchy detected: You cannot select a child or descendant item as the parent.',
        });
      }

      // Check max depth
      const parentDepth = await calculateItemDepth(data.parentId);
      if (parentDepth >= 3) {
        return res.status(400).json({
          success: false,
          message: 'Maximum navigation nesting depth (3 levels) reached. Cannot move item here.',
        });
      }

      targetParentId = new mongoose.Types.ObjectId(data.parentId);
    }

    existing.label = data.label.trim();
    existing.url = data.url.trim();
    existing.icon = data.icon ? data.icon.trim() : '';
    existing.type = data.type || existing.type;
    existing.parentId = targetParentId;
    if (typeof data.displayOrder === 'number') existing.displayOrder = data.displayOrder;
    if (typeof data.isActive === 'boolean') existing.isActive = data.isActive;
    if (typeof data.openInNewTab === 'boolean') existing.openInNewTab = data.openInNewTab;
    existing.badge = data.badge ? data.badge.trim() : '';
    existing.badgeColor = data.badgeColor ? data.badgeColor.trim() : '';
    existing.description = data.description ? data.description.trim() : '';

    await existing.save();
    invalidateNavigationCache();

    await logAuditActivity({
      action: 'UPDATE_NAVIGATION_MENU',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Updated navigation menu "${existing.label}" (${existing._id})`,
      recordId: existing._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Menu item "${existing.label}" updated successfully.`,
      item: existing,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/navigation/:id/status
// Toggle active/inactive status
navigationRouter.patch('/:id/status', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid navigation item identifier.' });
    }

    const { isActive } = req.body;
    const item = await NavigationModel.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Navigation menu item not found.' });
    }

    item.isActive = typeof isActive === 'boolean' ? isActive : !item.isActive;
    await item.save();

    invalidateNavigationCache();

    await logAuditActivity({
      action: 'TOGGLE_NAVIGATION_STATUS',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `${item.isActive ? 'Activated' : 'Deactivated'} navigation menu "${item.label}"`,
      recordId: item._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Navigation item "${item.label}" is now ${item.isActive ? 'Active' : 'Inactive'}.`,
      item,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/navigation/:id
// Safely delete a navigation menu item with child handling options
navigationRouter.delete('/:id', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid navigation item identifier.' });
    }

    const item = await NavigationModel.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Navigation menu item not found.' });
    }

    const childAction = (req.query.action as string) || (req.body.action as string) || 'reassign';
    const childCount = await NavigationModel.countDocuments({ parentId: id });

    if (childCount > 0) {
      if (childAction === 'cascade') {
        // Cascade delete: delete all descendant items
        await NavigationModel.deleteMany({ parentId: id });
      } else {
        // Safe reassign: Promote children to item's parent so they aren't orphaned
        await NavigationModel.updateMany(
          { parentId: id },
          { $set: { parentId: item.parentId } }
        );
      }
    }

    await NavigationModel.findByIdAndDelete(id);
    invalidateNavigationCache();

    await logAuditActivity({
      action: 'DELETE_NAVIGATION_MENU',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Deleted navigation menu "${item.label}" (${childCount} children ${childAction === 'cascade' ? 'deleted' : 'reassigned'})`,
      recordId: id,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Menu item "${item.label}" deleted successfully.`,
      childCount,
      childAction,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/navigation/seed-defaults
// Administrative endpoint to restore default navigation menu
navigationRouter.post('/seed-defaults', ...adminProtected, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NavigationModel.deleteMany({});
    const seeded = await NavigationModel.insertMany(initialNavigation);
    invalidateNavigationCache();

    await logAuditActivity({
      action: 'SEED_DEFAULT_NAVIGATION',
      module: 'Navigation Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Reset and seeded ${seeded.length} default navigation menus.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Successfully seeded ${seeded.length} default navigation menu items.`,
      items: seeded,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
