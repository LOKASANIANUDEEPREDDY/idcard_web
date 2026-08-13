import { useEffect, useState } from 'react'
import {
  MessageSquare,
  Moon,
  Sun,
  Crop,
  Crown,
  LogOut,
  Shield,
} from 'lucide-react'
import { useStudio } from '../store/StudioContext'
import { useAuth } from '../auth/AuthContext'
import { PLAN_LABELS } from '../auth/types'
import { formatExpiry } from '../auth/keys'
import { clsx } from '../lib/utils'

interface HeaderProps {
  onOpenSubscribe: () => void
  onOpenAdmin: () => void
}

export function Header({ onOpenSubscribe, onOpenAdmin }: HeaderProps) {
  const { state, setTheme } = useStudio()
  const { user, logout, hasActiveSubscription, photosRemaining, freeLimit, isCeo } = useAuth()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  const planLabel = user ? PLAN_LABELS[user.plan] : 'Free'
  const usageLabel = hasActiveSubscription
    ? `Unlimited · until ${formatExpiry(user?.planExpiresAt ?? null, user?.plan ?? 'free')}`
    : `${Math.max(0, Number.isFinite(photosRemaining) ? photosRemaining : 0)}/${freeLimit} free left`

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"
              aria-hidden
            >
              <Crop className="size-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
                Face Crop Studio
              </h1>
              <p className="truncate text-xs text-muted">
                {user?.name} · {planLabel} · {usageLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              onClick={onOpenSubscribe}
            >
              <Crown className="size-4" />
              <span className="hidden sm:inline">
                {hasActiveSubscription ? 'Plan' : 'Subscribe'}
              </span>
            </button>
            {isCeo && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface"
                onClick={onOpenAdmin}
              >
                <Shield className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquare className="size-4" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
            <button
              type="button"
              className="rounded-lg border border-line p-2 text-ink hover:bg-surface"
              aria-label={state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(state.theme === 'dark' ? 'light' : 'dark')}
            >
              {state.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              onClick={logout}
              title="Log out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold">Send feedback</h2>
            <p className="mt-2 text-sm text-muted">
              Face Crop Studio processes images entirely in your browser. No photos leave your
              device.
            </p>
            <textarea
              className="mt-4 h-28 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              placeholder="Your feedback…"
              aria-label="Feedback message"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-line px-4 py-2 text-sm"
                onClick={() => setFeedbackOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800',
                )}
                onClick={() => setFeedbackOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
