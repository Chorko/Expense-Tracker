'use client'

import { useEffect, useId, useLayoutEffect, useRef } from 'react'

type ModalProps = {
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Block closing (Esc, backdrop, ✕) while something is saving */
  busy?: boolean
}

/**
 * Accessible modal built on the native <dialog> element: focus is trapped,
 * the page behind is inert, Esc closes it, and focus returns to whatever
 * opened it. Render it conditionally: mounting opens it.
 */
export function Modal({ title, description, onClose, children, footer, size = 'md', busy = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  // Only a press that starts AND ends on the backdrop closes the dialog
  // (dragging a text selection out of an input must not)
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
    busyRef.current = busy
  })

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    if (!dialog.open) dialog.showModal()
    document.body.style.overflow = 'hidden'

    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  function requestClose() {
    if (!busyRef.current) onCloseRef.current()
  }

  return (
    <dialog
      ref={ref}
      className={`modal ${size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={event => {
        // Esc: let React state decide whether the dialog goes away
        event.preventDefault()
        requestClose()
      }}
      onMouseDown={event => {
        pressedBackdrop.current = event.target === event.currentTarget
      }}
      onClick={event => {
        if (pressedBackdrop.current && event.target === event.currentTarget) requestClose()
        pressedBackdrop.current = false
      }}
    >
      <div className="modal-header">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold text-parchment leading-snug">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-sm text-parchment-dim mt-0.5">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="btn btn-ghost btn-icon -mr-1 -mt-1 shrink-0"
          aria-label="Close dialog"
          disabled={busy}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  )
}
