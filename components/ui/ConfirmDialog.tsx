'use client'

import { useState, useTransition } from 'react'
import { Modal } from './Modal'

type ConfirmResult = { success: boolean; error?: string } | void

type ConfirmDialogProps = {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => Promise<ConfirmResult>
  onClose: () => void
  /** Called after a successful confirm, just before closing */
  onDone?: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  onConfirm,
  onClose,
  onDone,
}: ConfirmDialogProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function confirm() {
    setError('')
    startTransition(async () => {
      const result = await onConfirm()
      if (result && !result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      onDone?.()
      onClose()
    })
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      busy={pending}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={confirm}
            disabled={pending}
            autoFocus
          >
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-parchment-dim">{message}</div>
      {error && (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
