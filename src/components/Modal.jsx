import React from 'react';
import { t } from "../i18n";
import './modals.css';

export default function Modal({ open, onClose, title, children, size = 'md', headerClassName = '' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title || t("Dialog")}>
      <div className={`modal-card modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <header className={`modal-header ${headerClassName}`}>
          {title && <h3 className="modal-title">{title}</h3>}
          <button className="modal-close" aria-label={t("Close")} onClick={onClose}>×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}