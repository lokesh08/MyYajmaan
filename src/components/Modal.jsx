import React from 'react';
import './modals.css';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className={`modal-card modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          {title && <h3 className="modal-title">{title}</h3>}
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}