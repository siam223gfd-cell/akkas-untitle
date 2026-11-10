import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Layers,
  Sparkles,
  ShoppingBag,
  Smartphone,
  Headphones,
  Laptop,
  Tag,
  HelpCircle,
  Folder,
  Zap,
  Flame,
  Package,
  Star,
  Heart,
  Grid,
  Home,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { NavigationItem } from '../../types';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';
import { AdminModal, ConfirmDialog } from './common/modal';

// Icon map for dynamic navigation icons
export const ICON_OPTIONS: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ShoppingBag', label: 'Shopping Bag', icon: ShoppingBag },
  { id: 'Smartphone', label: 'Smartphone', icon: Smartphone },
  { id: 'Headphones', label: 'Headphones / Audio', icon: Headphones },
  { id: 'Laptop', label: 'Laptop / PC', icon: Laptop },
  { id: 'Sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'Tag', label: 'Tag / Offers', icon: Tag },
  { id: 'Zap', label: 'Lightning / Flash', icon: Zap },
  { id: 'Flame', label: 'Flame / Hot', icon: Flame },
  { id: 'Package', label: 'Package / Box', icon: Package },
  { id: 'Star', label: 'Star / Featured', icon: Star },
  { id: 'Heart', label: 'Heart / Wishlist', icon: Heart },
  { id: 'HelpCircle', label: 'Help / Support', icon: HelpCircle },
  { id: 'Compass', label: 'Compass / Explore', icon: Compass },
  { id: 'Grid', label: 'Grid / Catalog', icon: Grid },
  { id: 'Folder', label: 'Folder / Group', icon: Folder },
  { id: 'Home', label: 'Home', icon: Home },
  { id: 'ExternalLink', label: 'External Link', icon: ExternalLink },
];

export const renderNavIcon = (iconName?: string, className = 'w-4 h-4') => {
  const match = ICON_OPTIONS.find((opt) => opt.id === iconName);
  if (!match) return null;
  const IconComponent = match.icon;
  return <IconComponent className={className} />;
};

interface NavigationFormData {
  label: string;
  url: string;
  icon: string;
  type: 'link' | 'dropdown' | 'category' | 'page';
  parentId: string;
  displayOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  badge: string;
  badgeColor: string;
  description: string;
}

const DEFAULT_FORM: NavigationFormData = {
  label: '',
  url: '',
  icon: 'Compass',
  type: 'link',
  parentId: '',
  displayOrder: 1,
  isActive: true,
  openInNewTab: false,
  badge: '',
  badgeColor: '#3b82f6',
  description: '',
};

export const NavigationManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [flatItems, setFlatItems] = useState<NavigationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);
  const [formData, setFormData] = useState<NavigationFormData>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    item: NavigationItem | null;
    action: 'reassign' | 'cascade';
  }>({
    isOpen: false,
    item: null,
    action: 'reassign',
  });

  // Seed confirmation modal
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  const fetchNavigation = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{
        success: boolean;
        items: NavigationItem[];
        flatItems: NavigationItem[];
      }>('/navigation/admin');

      if (res.success) {
        setItems(res.items || []);
        setFlatItems(res.flatItems || []);
        // Automatically expand top-level nodes on first load
        const initialExpanded: Record<string, boolean> = {};
        (res.items || []).forEach((item: NavigationItem) => {
          if (item.children && item.children.length > 0) {
            initialExpanded[item._id] = true;
          }
        });
        setExpandedNodes((prev) => ({ ...initialExpanded, ...prev }));
      }
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Failed to load navigation',
          message: err.message || 'Error fetching navigation items from server',
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNavigation();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = (parentId?: string) => {
    setEditingItem(null);
    const nextOrder = parentId
      ? flatItems.filter((i) => i.parentId === parentId).length + 1
      : flatItems.filter((i) => !i.parentId).length + 1;

    setFormData({
      ...DEFAULT_FORM,
      parentId: parentId || '',
      displayOrder: nextOrder,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: NavigationItem) => {
    setEditingItem(item);
    setFormData({
      label: item.label,
      url: item.url,
      icon: item.icon || '',
      type: item.type,
      parentId: item.parentId || '',
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      openInNewTab: item.openInNewTab || false,
      badge: item.badge || '',
      badgeColor: item.badgeColor || '#3b82f6',
      description: item.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      dispatch(addToast({ type: 'warning', title: 'Validation Error', message: 'Menu label is required.' }));
      return;
    }
    if (!formData.url.trim()) {
      dispatch(addToast({ type: 'warning', title: 'Validation Error', message: 'Navigation URL or path is required.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        label: formData.label.trim(),
        url: formData.url.trim(),
        icon: formData.icon || undefined,
        type: formData.type,
        parentId: formData.parentId ? formData.parentId : null,
        displayOrder: Number(formData.displayOrder) || 1,
        isActive: formData.isActive,
        openInNewTab: formData.openInNewTab,
        badge: formData.badge.trim() || undefined,
        badgeColor: formData.badgeColor || undefined,
        description: formData.description.trim() || undefined,
      };

      if (editingItem) {
        await apiRequest(`/navigation/${editingItem._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        dispatch(addToast({ type: 'success', title: 'Item Updated', message: `"${payload.label}" updated successfully.` }));
      } else {
        await apiRequest('/navigation', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        dispatch(addToast({ type: 'success', title: 'Item Created', message: `"${payload.label}" created successfully.` }));
      }

      setIsModalOpen(false);
      await fetchNavigation();
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Operation Failed',
          message: err.message || 'Could not save navigation item',
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: NavigationItem) => {
    try {
      const res = await apiRequest<{ success: boolean; item: NavigationItem }>(
        `/navigation/${item._id}/status`,
        { method: 'PATCH' }
      );
      if (res.success) {
        dispatch(
          addToast({
            type: 'info',
            title: res.item.isActive ? 'Menu Activated' : 'Menu Deactivated',
            message: `"${item.label}" is now ${res.item.isActive ? 'active' : 'inactive'}.`,
          })
        );
        fetchNavigation();
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to toggle status' }));
    }
  };

  const handleMoveOrder = async (item: NavigationItem, direction: 'up' | 'down') => {
    // Find siblings
    const siblings = flatItems
      .filter((i) => (i.parentId || null) === (item.parentId || null))
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const index = siblings.findIndex((i) => i._id === item._id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === siblings.length - 1) return;

    const swapTargetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = siblings[index];
    const targetItem = siblings[swapTargetIndex];

    const updatedOrderList = [
      { id: currentItem._id, displayOrder: targetItem.displayOrder },
      { id: targetItem._id, displayOrder: currentItem.displayOrder },
    ];

    try {
      await apiRequest('/navigation/reorder', {
        method: 'PUT',
        body: JSON.stringify({ items: updatedOrderList }),
      });
      fetchNavigation();
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Reorder Failed', message: err.message }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item) return;
    try {
      await apiRequest(`/navigation/${deleteModal.item._id}?action=${deleteModal.action}`, {
        method: 'DELETE',
      });
      dispatch(
        addToast({
          type: 'success',
          title: 'Item Deleted',
          message: `"${deleteModal.item.label}" was deleted successfully.`,
        })
      );
      setDeleteModal({ isOpen: false, item: null, action: 'reassign' });
      fetchNavigation();
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Delete Failed', message: err.message }));
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await apiRequest('/navigation/seed-defaults', { method: 'POST' });
      dispatch(
        addToast({
          type: 'success',
          title: 'Default Navigation Restored',
          message: 'The canonical storefront navigation items have been seeded.',
        })
      );
      setSeedConfirmOpen(false);
      fetchNavigation();
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Reset Failed', message: err.message }));
    }
  };

  // Find descendants to avoid circular parenting in selector
  const invalidParentIds = useMemo(() => {
    if (!editingItem) return new Set<string>();
    const invalid = new Set<string>();
    invalid.add(editingItem._id);

    const addDescendants = (parentId: string) => {
      flatItems
        .filter((i) => i.parentId === parentId)
        .forEach((child) => {
          invalid.add(child._id);
          addDescendants(child._id);
        });
    };
    addDescendants(editingItem._id);
    return invalid;
  }, [editingItem, flatItems]);

  const potentialParents = useMemo(() => {
    return flatItems.filter((i) => !invalidParentIds.has(i._id));
  }, [flatItems, invalidParentIds]);

  // Statistics
  const stats = useMemo(() => {
    const total = flatItems.length;
    const active = flatItems.filter((i) => i.isActive).length;
    const topLevel = flatItems.filter((i) => !i.parentId).length;
    const dropdowns = flatItems.filter((i) => i.type === 'dropdown' || (i.childrenCount && i.childrenCount > 0)).length;
    return { total, active, topLevel, dropdowns };
  }, [flatItems]);

  // Filtered Items for flat view or search
  const filteredFlatItems = useMemo(() => {
    if (!searchQuery.trim()) return flatItems;
    const q = searchQuery.toLowerCase();
    return flatItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.url.toLowerCase().includes(q) || i.badge?.toLowerCase().includes(q)
    );
  }, [flatItems, searchQuery]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: NavigationItem, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node._id];

    return (
      <div key={node._id} className="group">
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
            node.isActive
              ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90'
              : 'bg-slate-950/40 border-slate-900/60 opacity-60 hover:opacity-100'
          } ${depth > 0 ? 'mt-2' : 'mt-2.5'}`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          {/* Left: Drag indicator, Expand toggle, Icon, Label, Badges */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node._id)}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                title={isExpanded ? 'Collapse submenus' : 'Expand submenus'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              </div>
            )}

            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              {renderNavIcon(node.icon) || <Compass className="w-4 h-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white truncate text-sm">{node.label}</span>
                {node.badge && (
                  <span
                    className="px-2 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `${node.badgeColor || '#3b82f6'}25`,
                      color: node.badgeColor || '#60a5fa',
                      border: `1px solid ${node.badgeColor || '#3b82f6'}40`,
                    }}
                  >
                    {node.badge}
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 uppercase font-mono">
                  {node.type}
                </span>
                {node.openInNewTab && (
                  <span className="text-slate-400 text-xs flex items-center gap-0.5" title="Opens in new tab">
                    <ExternalLink className="w-3 h-3" />
                  </span>
                )}
                {hasChildren && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {node.children!.length} {node.children!.length === 1 ? 'submenu' : 'submenus'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 truncate">
                <span className="font-mono text-slate-500 truncate">{node.url}</span>
                {node.description && <span className="text-slate-400 italic truncate">— {node.description}</span>}
              </div>
            </div>
          </div>

          {/* Right: Order controls, Active toggle, Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {/* Reorder Buttons */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
              <button
                type="button"
                onClick={() => handleMoveOrder(node, 'up')}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                title="Move Up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveOrder(node, 'down')}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                title="Move Down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Active Toggle */}
            <button
              type="button"
              onClick={() => handleToggleStatus(node)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                node.isActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {node.isActive ? 'Active' : 'Inactive'}
            </button>

            {/* Add Submenu Button (if depth < 2, allows max 3 levels: depth 0, 1, 2) */}
            {depth < 2 && (
              <button
                type="button"
                onClick={() => handleOpenCreate(node._id)}
                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg border border-slate-800 transition-colors"
                title="Add Submenu under this item"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* Edit Button */}
            <button
              type="button"
              onClick={() => handleOpenEdit(node)}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg border border-slate-800 transition-colors"
              title="Edit navigation item"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => {
                setDeleteModal({
                  isOpen: true,
                  item: node,
                  action: hasChildren ? 'reassign' : 'cascade',
                });
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 transition-colors"
              title="Delete navigation item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children Sub-tree */}
        {hasChildren && isExpanded && (
          <div className="relative border-l-2 border-slate-800 ml-4 pl-1">
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Dynamic Navigation Menu</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage top navigation bars, nested dropdowns, promotional badges, and target destinations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchNavigation}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors disabled:opacity-50"
            title="Refresh navigation from database"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setSeedConfirmOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
            title="Reset to canonical storefront menu items"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Menu Items</div>
          <div className="text-2xl font-bold text-white mt-1.5 flex items-center gap-2">
            {stats.total}
            <span className="text-xs font-normal text-slate-400">items</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Published</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5 flex items-center gap-2">
            {stats.active}
            <span className="text-xs font-normal text-slate-400">visible</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Top-Level Items</div>
          <div className="text-2xl font-bold text-blue-400 mt-1.5 flex items-center gap-2">
            {stats.topLevel}
            <span className="text-xs font-normal text-slate-400">headers</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Dropdowns & Trees</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1.5 flex items-center gap-2">
            {stats.dropdowns}
            <span className="text-xs font-normal text-slate-400">nested</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & View Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search menu labels, URLs, badges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'tree' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hierarchy Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'flat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && flatItems.length === 0 ? (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="text-sm">Loading dynamic navigation hierarchy...</p>
        </div>
      ) : flatItems.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8">
          <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Navigation Items Configured</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Your storefront menu is currently empty. You can restore canonical default items or create custom ones.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Seed Default Storefront Menu
            </button>
          </div>
        </div>
      ) : viewMode === 'tree' && !searchQuery ? (
        <div className="space-y-1">
          {items.map((rootNode) => renderTreeNode(rootNode, 0))}
        </div>
      ) : (
        /* Flat / Search Table View */
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Item Label</th>
                <th className="px-4 py-3">Destination URL</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Parent Item</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFlatItems.map((item) => {
                const parent = flatItems.find((p) => p._id === item.parentId);
                return (
                  <tr key={item._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{item.displayOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                          {renderNavIcon(item.icon, 'w-3.5 h-3.5') || <Compass className="w-3.5 h-3.5" />}
                        </div>
                        <span className="font-medium text-white">{item.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-xs truncate">{item.url}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono uppercase">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{parent ? parent.label : '— (Top Level)'}</td>
                    <td className="px-4 py-3">
                      {item.badge ? (
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase"
                          style={{
                            backgroundColor: `${item.badgeColor || '#3b82f6'}20`,
                            color: item.badgeColor || '#60a5fa',
                            border: `1px solid ${item.badgeColor || '#3b82f6'}40`,
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                          item.isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteModal({
                              isOpen: true,
                              item,
                              action: item.childrenCount && item.childrenCount > 0 ? 'reassign' : 'cascade',
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= Item Create / Edit Modal ================= */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Edit Menu Item: ${editingItem.label}` : 'Create Navigation Menu Item'}
        size="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Menu Label <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g. Smartphones, Audio, Special Offers"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Destination URL / Path <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="e.g. /shop?category=mobile-tablets or /contact"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Menu Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="link">Standard Link</option>
                <option value="dropdown">Dropdown Container</option>
                <option value="category">Category Link</option>
                <option value="page">CMS Custom Page</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Parent Menu (Hierarchy)
              </label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">— None (Top Level Menu Bar) —</option>
                {potentialParents.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.parentId ? `└─ ${p.label}` : p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Display Order
              </label>
              <input
                type="number"
                min="1"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Menu Icon
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl">
              {ICON_OPTIONS.map((opt) => {
                const isSelected = formData.icon === opt.id;
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: opt.id })}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <IconComp className="w-4 h-4 mb-1" />
                    <span className="truncate w-full text-center text-[10px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Promotional Badge & Color */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Badge Text (Optional)
              </label>
              <input
                type="text"
                value={formData.badge}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                placeholder="e.g. HOT, NEW, 50% OFF"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.badgeColor || '#3b82f6'}
                  onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                  className="w-9 h-9 p-0.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.badgeColor}
                  onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Description / Subtitle
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief hint for dropdowns"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-800"
              />
              <span className="text-sm font-medium text-slate-200">Active (Visible in storefront)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.openInNewTab}
                onChange={(e) => setFormData({ ...formData, openInNewTab: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-800"
              />
              <span className="text-sm font-medium text-slate-200">Open in new tab</span>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* ================= Delete Safety Confirmation Modal ================= */}
      {deleteModal.isOpen && deleteModal.item && (
        <AdminModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, item: null, action: 'reassign' })}
          title="Confirm Navigation Item Deletion"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-sm font-medium">
                Are you sure you want to delete <span className="font-bold">"{deleteModal.item.label}"</span>?
              </div>
            </div>

            {deleteModal.item.childrenCount && deleteModal.item.childrenCount > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  This item has <span className="font-semibold text-blue-400">{deleteModal.item.childrenCount} child submenus</span>.
                  Choose how to handle the child items:
                </p>

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="deleteAction"
                      checked={deleteModal.action === 'reassign'}
                      onChange={() => setDeleteModal({ ...deleteModal, action: 'reassign' })}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">Reassign children to parent</div>
                      <div className="text-xs text-slate-400">Keep child submenus and lift them up one hierarchy level.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-900/40 bg-rose-950/20 cursor-pointer hover:border-rose-700">
                    <input
                      type="radio"
                      name="deleteAction"
                      checked={deleteModal.action === 'cascade'}
                      onChange={() => setDeleteModal({ ...deleteModal, action: 'cascade' })}
                      className="mt-1 text-rose-600"
                    />
                    <div>
                      <div className="text-sm font-semibold text-rose-300">Cascade delete (Remove all)</div>
                      <div className="text-xs text-rose-400/80">Permanently delete this item and ALL its nested child submenus.</div>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                This action cannot be undone. The menu item will be removed immediately from both the admin dashboard and storefront.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, item: null, action: 'reassign' })}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-500 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ================= Reset Defaults Confirmation Dialog ================= */}
      <ConfirmDialog
        isOpen={seedConfirmOpen}
        onClose={() => setSeedConfirmOpen(false)}
        onConfirm={handleSeedDefaults}
        title="Reset Storefront Navigation to Defaults?"
        message="This will seed canonical default navigation items (Shop All, Smartphones, Audio, Laptops, New Arrivals, Special Offers, Support) into your database. Existing custom items will not be overwritten if they have distinct labels."
        confirmLabel="Reset to Defaults"
      />
    </div>
  );
};
