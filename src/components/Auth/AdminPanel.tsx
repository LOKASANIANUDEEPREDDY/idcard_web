import { useMemo, useState } from 'react'
import { Copy, Download, KeyRound, Shield, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { formatExpiry } from '../../auth/keys'
import { PAID_PLANS, PLAN_LABELS, type PlanId } from '../../auth/types'
import { clsx } from '../../lib/utils'

interface AdminPanelProps {
  open: boolean
  onClose: () => void
}

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { isCeo, db, generateKeys, revokeKey, exportDb, importDb, user } = useAuth()
  const [plan, setPlan] = useState<Exclude<PlanId, 'free'>>('1m')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [created, setCreated] = useState<string[]>([])
  const [message, setMessage] = useState('')

  const sortedKeys = useMemo(
    () => [...db.keys].sort((a, b) => b.createdAt - a.createdAt),
    [db.keys],
  )
  const sortedUsers = useMemo(
    () => [...db.users].sort((a, b) => b.lastLoginAt - a.lastLoginAt),
    [db.users],
  )

  if (!open) return null

  if (!isCeo) {
    return (
      <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 p-4">
        <div className="max-w-sm rounded-2xl border border-line bg-panel p-5 text-sm text-ink">
          CEO access required. Log in as <span className="font-mono">CEO</span>.
          <button type="button" className="mt-4 block underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const onGenerate = () => {
    const keys = generateKeys(plan, qty, note)
    setCreated(keys.map((k) => k.code))
    setMessage(`Generated ${keys.length} ${PLAN_LABELS[plan]} key${keys.length === 1 ? '' : 's'}.`)
  }

  const copyAll = async () => {
    if (!created.length) return
    await navigator.clipboard.writeText(created.join('\n'))
    setMessage('Copied keys to clipboard.')
  }

  const downloadExport = () => {
    const blob = new Blob([exportDb()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `face-crop-studio-auth-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const result = importDb(text)
    setMessage(result.ok ? 'Imported login & key database.' : result.error || 'Import failed.')
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal
      aria-label="Admin key manager"
    >
      <div className="flex max-h-[min(920px,96vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-brand-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
                CEO Admin · Keys & Logins
              </h2>
              <p className="text-xs text-muted">Signed in as {user?.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-surface"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="no-scrollbar grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <KeyRound className="size-4" />
              Generate subscription keys
            </h3>
            <label className="block text-xs font-medium text-muted">
              Plan
              <select
                className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink"
                value={plan}
                onChange={(e) => setPlan(e.target.value as Exclude<PlanId, 'free'>)}
              >
                {PAID_PLANS.map((id) => (
                  <option key={id} value={id}>
                    {PLAN_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted">
              Quantity
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Note (optional)
              <input
                className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink"
                value={note}
                placeholder="School / invoice #"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              onClick={onGenerate}
            >
              Generate keys
            </button>

            {created.length > 0 && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-900 dark:bg-brand-950/30">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink">New keys</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 dark:text-brand-200"
                    onClick={() => void copyAll()}
                  >
                    <Copy className="size-3.5" />
                    Copy all
                  </button>
                </div>
                <ul className="space-y-1 font-mono text-xs text-ink">
                  {created.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold"
                onClick={downloadExport}
              >
                <Download className="size-3.5" />
                Export DB
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold">
                <Upload className="size-3.5" />
                Import DB
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {message && <p className="text-xs text-muted">{message}</p>}
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4">
            <h3 className="text-sm font-semibold text-ink">
              Registered users ({sortedUsers.length})
            </h3>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {sortedUsers.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-line bg-panel px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">
                      {u.name}{' '}
                      {u.role === 'ceo' && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          CEO
                        </span>
                      )}
                    </p>
                    <span className="text-muted">{PLAN_LABELS[u.plan]}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    Photos used: {u.photosUsed}
                    {' · '}Expires: {formatExpiry(u.planExpiresAt, u.plan)}
                  </p>
                  {u.licenseKey && (
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{u.licenseKey}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-surface/50 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink">All keys ({sortedKeys.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-2 font-medium">Key</th>
                    <th className="py-2 pr-2 font-medium">Plan</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                    <th className="py-2 pr-2 font-medium">Note</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedKeys.map((k) => {
                    const holder = db.users.find((u) => u.id === k.redeemedBy)
                    return (
                      <tr key={k.code} className="border-b border-line/70">
                        <td className="py-2 pr-2 font-mono text-[11px] text-ink">{k.code}</td>
                        <td className="py-2 pr-2">{PLAN_LABELS[k.plan]}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                              k.status === 'available' && 'bg-emerald-100 text-emerald-800',
                              k.status === 'redeemed' && 'bg-sky-100 text-sky-800',
                              k.status === 'revoked' && 'bg-red-100 text-red-800',
                              k.status === 'expired' && 'bg-neutral-200 text-neutral-700',
                            )}
                          >
                            {k.status}
                          </span>
                          {holder && (
                            <span className="ml-1 text-muted">· {holder.name}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-muted">{k.note || '—'}</td>
                        <td className="py-2">
                          {k.status !== 'revoked' && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-danger hover:underline"
                              onClick={() => revokeKey(k.code)}
                            >
                              <Trash2 className="size-3.5" />
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {sortedKeys.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted">
                        No keys yet. Generate a plan key above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
