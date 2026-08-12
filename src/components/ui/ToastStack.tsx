import { useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useStudio } from '../../store/StudioContext'
import { clsx } from '../../lib/utils'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'border-success/30 bg-white dark:bg-panel text-success',
  error: 'border-danger/30 bg-white dark:bg-panel text-danger',
  warning: 'border-warning/30 bg-white dark:bg-panel text-warning',
  info: 'border-info/30 bg-white dark:bg-panel text-info',
}

export function ToastStack() {
  const { state, dismissToast } = useStudio()

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(100%-2rem,360px)] flex-col gap-2"
      aria-live="polite"
    >
      {state.toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} type={t.type} message={t.message} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

function ToastItem({
  id,
  type,
  message,
  onDismiss,
}: {
  id: string
  type: keyof typeof icons
  message: string
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 4200)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  const Icon = icons[type]

  return (
    <div
      className={clsx(
        'pointer-events-auto animate-fade-in flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
        colors[type],
      )}
      role="status"
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-medium text-ink">{message}</p>
      <button
        type="button"
        className="rounded-md p-1 text-muted hover:bg-surface"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
