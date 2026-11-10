import React, { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

/* =========================================================================
   1. TYPES & INTERFACES
   ========================================================================= */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';

export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  maxWidth?: ModalSize; // alias for size for backward compatibility
  preventBackdropClose?: boolean;
  hasUnsavedChanges?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
}

export interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  recordIdentifier?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isConfirming?: boolean;
}

/* =========================================================================
   2. SIZE MAPS
   ========================================================================= */

const MODAL_SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[96vw] h-[92vh]',
};

const DRAWER_WIDTH_CLASSES = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/* =========================================================================
   3. ENTERPRISE ADMIN MODAL
   ========================================================================= */

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footer,
  size,
  maxWidth = 'lg',
  preventBackdropClose = false,
  hasUnsavedChanges = false,
  className = '',
  bodyClassName = '',
  headerClassName = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const actualSize = size || maxWidth;
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardPrompt(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowDiscardPrompt(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasUnsavedChanges) {
          setShowDiscardPrompt(true);
        } else {
          onClose();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, hasUnsavedChanges]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !preventBackdropClose) {
      requestClose();
    }
  };

  const isFullScreen = actualSize === 'full';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`relative w-full ${MODAL_SIZE_CLASSES[actualSize]} bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col ${
          isFullScreen ? 'h-[92vh]' : 'max-h-[92vh]'
        } transform transition-all duration-200 scale-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div
            className={`flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white shrink-0 ${headerClassName}`}
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-4">
              {icon && (
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/70 shadow-xs">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeof title === 'string' ? (
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {badge && <div>{badge}</div>}
                </div>
                {subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={requestClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Inline Unsaved Changes Prompt */}
        {showDiscardPrompt && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You have unsaved changes. Discard them and close this modal?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiscardPrompt(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardPrompt(false);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className={`p-6 overflow-y-auto flex-1 overscroll-contain ${bodyClassName}`}>
          {children}
        </div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   4. ENTERPRISE ADMIN DRAWER (Slide-in from right)
   ========================================================================= */

export const AdminDrawer: React.FC<AdminDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footer,
  width = 'lg',
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${DRAWER_WIDTH_CLASSES[width]} bg-white h-full shadow-2xl border-l border-slate-200/90 flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-right duration-300 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-4">
            {icon && (
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/70 shadow-xs">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {typeof title === 'string' ? (
                  <h3 className="text-base font-black text-slate-900 tracking-tight truncate">
                    {title}
                  </h3>
                ) : (
                  title
                )}
                {badge && <div>{badge}</div>}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-5">
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   5. ENTERPRISE CONFIRM DIALOG (Replaces window.confirm)
   ========================================================================= */

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  recordIdentifier,
  confirmLabel = 'Delete Record',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isConfirming = false,
}) => {
  if (!isOpen) return null;

  const colorConfig = {
    danger: {
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
      btnBg: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      btnBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
    },
    info: {
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      icon: <Info className="w-5 h-5 text-blue-600" />,
      btnBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-6 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${colorConfig.iconBg}`}
          >
            {colorConfig.icon}
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-black text-slate-900 tracking-tight">{title}</h3>
            {recordIdentifier && (
              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 font-mono text-[11px] font-bold text-slate-700 truncate max-w-full">
                {recordIdentifier}
              </span>
            )}
            <div className="text-xs text-slate-500 leading-relaxed pt-1">{message}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isConfirming}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 ${colorConfig.btnBg}`}
          >
            {isConfirming ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
