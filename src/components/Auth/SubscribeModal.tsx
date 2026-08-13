import { useState } from 'react'
import { Crown, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { PLAN_LABELS } from '../../auth/types'
import { formatExpiry } from '../../auth/keys'

interface SubscribeModalProps {
  open: boolean
  onClose: () => void
}

export function SubscribeModal({ open, onClose }: SubscribeModalProps) {
  const { redeemKey, user, hasActiveSubscription, freeLimit } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const result = await redeemKey(code)
      if (!result.ok) {
        setError(result.error || 'Could not redeem key.')
        return
      }
      setSuccess(
        `Unlocked ${PLAN_LABELS[result.plan || '1m']}. You can process unlimited photos until expiry.`,
      )
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal
      aria-label="Subscribe"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Crown className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Subscription</h2>
              <p className="text-xs text-muted">Enter the key from your payment plan</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm text-ink">
          {hasActiveSubscription && user ? (
            <>
              <p className="font-semibold">{PLAN_LABELS[user.plan]} plan active</p>
              <p className="mt-1 text-xs text-muted">
                Expires: {formatExpiry(user.planExpiresAt, user.plan)}
                {user.licenseKey ? ` · Key ${user.licenseKey}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Free plan</p>
              <p className="mt-1 text-xs text-muted">
                {user
                  ? `${Math.max(0, freeLimit - user.photosUsed)} of ${freeLimit} free photos remaining · used ${user.photosUsed}`
                  : `${freeLimit} free photos`}
              </p>
            </>
          )}
        </div>

        <form className="space-y-3" onSubmit={(e) => void submit(e)}>
          <label className="block text-sm font-medium text-ink">
            Subscription key
            <input
              className="mt-1.5 w-full rounded-xl border border-line bg-panel px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-ink outline-none focus:border-brand-500"
              placeholder="FCS-1M-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </label>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/30">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {success}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Activate key'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Plans: 1 month · 3 months · 6 months · 1 year · All Time (CEO). Ask your admin for a key
          after payment.
        </p>
      </div>
    </div>
  )
}
