import { randomSegment } from './crypto'
import {
  PLAN_DURATION_MS,
  PLAN_LABELS,
  type LicenseKeyRecord,
  type PlanId,
} from './types'

export function generateLicenseCode(plan: Exclude<PlanId, 'free'>): string {
  const prefix =
    plan === 'lifetime' ? 'CEO' : plan === '1y' ? '1Y' : plan.toUpperCase()
  return `FCS-${prefix}-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`
}

export function computeExpiry(
  plan: Exclude<PlanId, 'free'>,
  from = Date.now(),
): number | null {
  if (plan === 'lifetime') return null
  return from + PLAN_DURATION_MS[plan]
}

export function createLicenseRecord(
  plan: Exclude<PlanId, 'free'>,
  note = '',
): LicenseKeyRecord {
  const createdAt = Date.now()
  return {
    code: generateLicenseCode(plan),
    plan,
    label: PLAN_LABELS[plan],
    status: 'available',
    createdAt,
    // Stored as plan length; actual user expiry starts at redeem time
    expiresAt: computeExpiry(plan, createdAt),
    redeemedBy: null,
    redeemedAt: null,
    note: note.trim(),
  }
}

export function isSubscriptionActive(
  plan: PlanId,
  planExpiresAt: number | null,
  now = Date.now(),
): boolean {
  if (plan === 'free') return false
  if (plan === 'lifetime') return true
  if (planExpiresAt == null) return false
  return planExpiresAt > now
}

export function formatExpiry(planExpiresAt: number | null, plan: PlanId): string {
  if (plan === 'lifetime') return 'Never (All Time)'
  if (!planExpiresAt) return '—'
  return new Date(planExpiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
