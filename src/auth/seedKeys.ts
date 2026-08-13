import { PLAN_LABELS, type LicenseKeyRecord, type PlanId } from './types'

/** Built-in keys from keys/KEYS.txt — always accepted on the website. */
const STARTER_KEYS: Array<{ code: string; plan: Exclude<PlanId, 'free'> }> = [
  // 1 Month
  { code: 'FCS-1M-DNNW-K8QN-TBCH', plan: '1m' },
  { code: 'FCS-1M-DVWV-Z3C8-F6XN', plan: '1m' },
  { code: 'FCS-1M-NGMX-PAAF-Y6EW', plan: '1m' },
  { code: 'FCS-1M-TP7P-C34Y-5P3P', plan: '1m' },
  { code: 'FCS-1M-7RM2-SWHN-EEDX', plan: '1m' },
  // 3 Months
  { code: 'FCS-3M-LYX5-S963-YDDS', plan: '3m' },
  { code: 'FCS-3M-GSV4-328L-HKMY', plan: '3m' },
  { code: 'FCS-3M-UNGT-NCGR-YMTM', plan: '3m' },
  { code: 'FCS-3M-LGK5-J4XS-XPZT', plan: '3m' },
  { code: 'FCS-3M-44RW-YWSN-3Q5L', plan: '3m' },
  // 6 Months
  { code: 'FCS-6M-ZQ4K-2FFD-RZ6A', plan: '6m' },
  { code: 'FCS-6M-2WF3-7DDL-8ZPE', plan: '6m' },
  { code: 'FCS-6M-BVFD-G3L9-7JLL', plan: '6m' },
  { code: 'FCS-6M-WCTK-YFKK-58XS', plan: '6m' },
  { code: 'FCS-6M-L6CK-4TBU-UEQ4', plan: '6m' },
  // 1 Year
  { code: 'FCS-1Y-UM8C-US9K-39MJ', plan: '1y' },
  { code: 'FCS-1Y-8Q55-J249-3N64', plan: '1y' },
  { code: 'FCS-1Y-FATK-PEAP-CTW4', plan: '1y' },
  { code: 'FCS-1Y-SZ6Y-5EL9-622S', plan: '1y' },
  { code: 'FCS-1Y-D2EV-9M37-YLTY', plan: '1y' },
  // All Time
  { code: 'FCS-CEO-DDFC-2G75-RYKG', plan: 'lifetime' },
  { code: 'FCS-CEO-44UN-5J7E-6XFU', plan: 'lifetime' },
  { code: 'FCS-CEO-6NJB-BPV4-B2FB', plan: 'lifetime' },
]

export function getStarterKeyRecords(now = Date.now()): LicenseKeyRecord[] {
  return STARTER_KEYS.map(({ code, plan }) => ({
    code,
    plan,
    label: PLAN_LABELS[plan],
    status: 'available' as const,
    createdAt: now,
    expiresAt: null,
    redeemedBy: null,
    redeemedAt: null,
    note: 'Starter pack (KEYS.txt)',
  }))
}

/**
 * Merge built-in KEYS.txt codes into the local DB.
 * Existing redeemed/revoked status is preserved.
 */
export function mergeStarterKeys(keys: LicenseKeyRecord[]): {
  keys: LicenseKeyRecord[]
  added: number
} {
  const byCode = new Map(keys.map((k) => [k.code.toUpperCase(), k]))
  let added = 0
  const now = Date.now()

  for (const seed of getStarterKeyRecords(now)) {
    const existing = byCode.get(seed.code.toUpperCase())
    if (!existing) {
      byCode.set(seed.code.toUpperCase(), seed)
      added += 1
      continue
    }
    // If someone revoked a starter key by mistake, keep their choice.
    // Only fill missing starter entries.
  }

  return { keys: Array.from(byCode.values()), added }
}

export function normalizeKeyInput(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}
