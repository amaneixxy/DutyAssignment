import React from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle size={20} className={tone === 'danger' ? 'text-coral-500' : 'text-amber-500'} />
        </div>
        <p className="text-sm text-ink-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  )
}
