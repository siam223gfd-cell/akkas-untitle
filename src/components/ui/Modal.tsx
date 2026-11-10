import React from 'react';
import { AdminModal, ModalSize } from '../admin/common/modal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: ModalSize;
  size?: ModalSize;
  preventBackdropClose?: boolean;
  hasUnsavedChanges?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  footer,
  children,
  maxWidth = 'lg',
  size,
  preventBackdropClose = false,
  hasUnsavedChanges = false,
}) => {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      badge={badge}
      footer={footer}
      size={size || maxWidth}
      preventBackdropClose={preventBackdropClose}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      {children}
    </AdminModal>
  );
};

export default Modal;

