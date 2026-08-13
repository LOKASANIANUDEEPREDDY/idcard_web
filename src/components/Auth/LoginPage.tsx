import { useState } from 'react'
import { Crop, KeyRound, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { FREE_PHOTO_LIMIT } from '../../auth/types'
import { clsx } from '../../lib/utils'

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = mode === 'login' ? await login(name, pin) : await register(name, pin)
      if (!result.ok) setError(result.error || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(13,148,136,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 75%, rgba(15,23,42,0.08), transparent 50%), linear-gradient(165deg, #f8fafc 0%, #ecfdf5 45%, #f1f5f9 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative w-full max-w-md rounded-3xl border border-line/80 bg-panel/95 p-6 shadow-xl backdrop-blur sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-sm">
            <Crop className="size-5" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
              Face Crop Studio
            </h1>
            <p className="text-sm text-muted">Sign in to crop ID photos</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(
                'rounded-lg py-2 text-sm font-semibold capitalize transition',
                mode === m ? 'bg-brand-700 text-white' : 'text-ink hover:bg-panel',
              )}
              onClick={() => {
                setMode(m)
                setError('')
              }}
            >
              {m === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <label className="block text-sm font-medium text-ink">
            Name
            <div className="relative mt-1.5">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-3 text-sm text-ink outline-none focus:border-brand-500"
                value={name}
                autoComplete="username"
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-ink">
            PIN
            <div className="relative mt-1.5">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-3 text-sm tracking-[0.25em] text-ink outline-none focus:border-brand-500"
                value={pin}
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="4–8 digits"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
              />
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 space-y-2 rounded-2xl border border-line bg-surface/80 p-4 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-ink">Free:</span> crop up to {FREE_PHOTO_LIMIT}{' '}
            photos. Need more? Redeem a subscription key after login.
          </p>
          <p>
            <span className="font-semibold text-ink">CEO:</span> login with name{' '}
            <span className="font-mono text-ink">CEO</span> and your CEO PIN to generate keys.
          </p>
        </div>
      </div>
    </div>
  )
}
