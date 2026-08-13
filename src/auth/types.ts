export type PlanId = 'free' | '1m' | '3m' | '6m' | '1y' | 'lifetime'

export type KeyStatus = 'available' | 'redeemed' | 'revoked' | 'expired'

export interface AuthUser {
  id: string
  name: string
  /** Lowercase unique key used for username uniqueness checks. */
  nameKey: string
  pinHash: string
  role: 'user' | 'ceo'
  plan: PlanId
  photosUsed: number
  licenseKey: string | null
  planExpiresAt: number | null
  createdAt: number
  lastLoginAt: number
}

export interface LicenseKeyRecord {
  code: string
  plan: Exclude<PlanId, 'free'>
  label: string
  status: KeyStatus
  createdAt: number
  expiresAt: number | null
  redeemedBy: string | null
  redeemedAt: number | null
  note: string
}

export interface AuthDatabase {
  version: 1
  users: AuthUser[]
  keys: LicenseKeyRecord[]
}

export const FREE_PHOTO_LIMIT = 2

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '1y': '1 Year',
  lifetime: 'All Time (CEO)',
}

export const PLAN_DURATION_MS: Record<Exclude<PlanId, 'free' | 'lifetime'>, number> = {
  '1m': 30 * 24 * 60 * 60 * 1000,
  '3m': 90 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
}

export const PAID_PLANS: Array<Exclude<PlanId, 'free'>> = [
  '1m',
  '3m',
  '6m',
  '1y',
  'lifetime',
]
