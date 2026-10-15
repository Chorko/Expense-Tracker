'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; tone: ToastTone; message: string }

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<ToastTone, string> = { success: '✓', error: '!', info: 'i' }
const COLORS: Record<ToastTone, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--brass)',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts(list => [...list.slice(-3), { id, tone, message }])
      timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000))
    },
    [dismiss]
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: message => push('success', message),
      error: message => push('error', message),
      info: message => push('info', message),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: `color-mix(in srgb, ${COLORS[toast.tone]} 18%, transparent)`, color: COLORS[toast.tone] }}
            >
              {ICONS[toast.tone]}
            </span>
            <p className="flex-1 text-parchment">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-parchment-faint hover:text-parchment"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
