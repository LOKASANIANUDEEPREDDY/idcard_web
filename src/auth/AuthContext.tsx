import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createId, hashPin } from './crypto'
import { computeExpiry, createLicenseRecord, isSubscriptionActive } from './keys'
import {
  exportDatabaseJson,
  importDatabaseJson,
  loadDatabase,
  loadSessionUserId,
  saveDatabase,
  saveSessionUserId,
} from './storage'
import {
  FREE_PHOTO_LIMIT,
  type AuthDatabase,
  type AuthUser,
  type LicenseKeyRecord,
  type PlanId,
} from './types'

/** Change via VITE_CEO_PIN in .env — digits only, 4–8 chars. */
const CEO_PIN = (import.meta.env.VITE_CEO_PIN as string | undefined)?.trim() || '20260026'
const CEO_NAME = 'CEO'

interface AuthContextValue {
  ready: boolean
  user: AuthUser | null
  db: AuthDatabase
  isLoggedIn: boolean
  isCeo: boolean
  hasActiveSubscription: boolean
  freeLimit: number
  photosRemaining: number
  canUploadCount: (count: number) => number
  login: (name: string, pin: string) => Promise<{ ok: boolean; error?: string }>
  register: (name: string, pin: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  redeemKey: (code: string) => Promise<{ ok: boolean; error?: string; plan?: PlanId }>
  recordPhotosUsed: (count: number) => void
  generateKeys: (
    plan: Exclude<PlanId, 'free'>,
    quantity: number,
    note?: string,
  ) => LicenseKeyRecord[]
  revokeKey: (code: string) => void
  exportDb: () => string
  importDb: (raw: string) => { ok: boolean; error?: string }
  refresh: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function findUser(db: AuthDatabase, name: string) {
  const key = normalizeName(name).toLowerCase()
  return db.users.find((u) => u.name.toLowerCase() === key) ?? null
}

function expireStaleSubscriptions(db: AuthDatabase): AuthDatabase {
  const now = Date.now()
  let changed = false
  const users = db.users.map((u) => {
    if (u.plan === 'free' || u.plan === 'lifetime') return u
    if (u.planExpiresAt != null && u.planExpiresAt <= now) {
      changed = true
      return {
        ...u,
        plan: 'free' as const,
        licenseKey: null,
        planExpiresAt: null,
      }
    }
    return u
  })
  const keys = db.keys.map((k) => {
    if (k.status !== 'available' && k.status !== 'redeemed') return k
    if (k.plan === 'lifetime') return k
    // Redeemed keys expire with the user; available keys don't auto-expire the code itself
    return k
  })
  if (!changed) return db
  const next = { ...db, users, keys }
  saveDatabase(next)
  return next
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AuthDatabase>(() => expireStaleSubscriptions(loadDatabase()))
  const [userId, setUserId] = useState<string | null>(() => loadSessionUserId())

  const refresh = useCallback(() => {
    setDb(expireStaleSubscriptions(loadDatabase()))
  }, [])

  const persist = useCallback((next: AuthDatabase) => {
    saveDatabase(next)
    setDb(next)
  }, [])

  const user = useMemo(
    () => (userId ? db.users.find((u) => u.id === userId) ?? null : null),
    [db.users, userId],
  )

  const hasActiveSubscription = useMemo(
    () => (user ? isSubscriptionActive(user.plan, user.planExpiresAt) : false),
    [user],
  )

  const photosRemaining = useMemo(() => {
    if (!user) return 0
    if (hasActiveSubscription) return Number.POSITIVE_INFINITY
    return Math.max(0, FREE_PHOTO_LIMIT - user.photosUsed)
  }, [user, hasActiveSubscription])

  const canUploadCount = useCallback(
    (count: number) => {
      if (!user) return 0
      if (hasActiveSubscription) return count
      return Math.max(0, Math.min(count, FREE_PHOTO_LIMIT - user.photosUsed))
    },
    [user, hasActiveSubscription],
  )

  const ensureCeoAccount = useCallback(
    async (current: AuthDatabase): Promise<AuthDatabase> => {
      const existing = findUser(current, CEO_NAME)
      const pinHash = await hashPin(CEO_PIN, CEO_NAME)
      if (existing) {
        if (existing.role === 'ceo' && existing.pinHash === pinHash) return current
        const users = current.users.map((u) =>
          u.id === existing.id
            ? {
                ...u,
                role: 'ceo' as const,
                plan: 'lifetime' as const,
                planExpiresAt: null,
                pinHash,
              }
            : u,
        )
        const next = { ...current, users }
        saveDatabase(next)
        return next
      }
      const ceo: AuthUser = {
        id: createId('usr'),
        name: CEO_NAME,
        pinHash,
        role: 'ceo',
        plan: 'lifetime',
        photosUsed: 0,
        licenseKey: null,
        planExpiresAt: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      }
      const next = { ...current, users: [...current.users, ceo] }
      saveDatabase(next)
      return next
    },
    [],
  )

  const login = useCallback(
    async (name: string, pin: string) => {
      const trimmed = normalizeName(name)
      if (!trimmed) return { ok: false, error: 'Enter your name.' }
      if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: 'PIN must be 4–8 digits.' }

      let current = expireStaleSubscriptions(loadDatabase())
      current = await ensureCeoAccount(current)
      setDb(current)

      const existing = findUser(current, trimmed)
      if (!existing) {
        return { ok: false, error: 'No account found. Create one with Register.' }
      }

      const pinHash = await hashPin(pin, existing.name)
      if (pinHash !== existing.pinHash) {
        return { ok: false, error: 'Incorrect PIN.' }
      }

      const users = current.users.map((u) =>
        u.id === existing.id ? { ...u, lastLoginAt: Date.now() } : u,
      )
      const next = { ...current, users }
      persist(next)
      setUserId(existing.id)
      saveSessionUserId(existing.id)
      return { ok: true }
    },
    [ensureCeoAccount, persist],
  )

  const register = useCallback(
    async (name: string, pin: string) => {
      const trimmed = normalizeName(name)
      if (!trimmed) return { ok: false, error: 'Enter your name.' }
      if (trimmed.toLowerCase() === CEO_NAME.toLowerCase()) {
        return { ok: false, error: 'That name is reserved. Use Login with the CEO PIN.' }
      }
      if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: 'PIN must be 4–8 digits.' }

      let current = expireStaleSubscriptions(loadDatabase())
      current = await ensureCeoAccount(current)

      if (findUser(current, trimmed)) {
        return { ok: false, error: 'Name already registered. Please log in.' }
      }

      const pinHash = await hashPin(pin, trimmed)
      const newUser: AuthUser = {
        id: createId('usr'),
        name: trimmed,
        pinHash,
        role: 'user',
        plan: 'free',
        photosUsed: 0,
        licenseKey: null,
        planExpiresAt: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      }
      const next = { ...current, users: [...current.users, newUser] }
      persist(next)
      setUserId(newUser.id)
      saveSessionUserId(newUser.id)
      return { ok: true }
    },
    [ensureCeoAccount, persist],
  )

  const logout = useCallback(() => {
    setUserId(null)
    saveSessionUserId(null)
  }, [])

  const redeemKey = useCallback(
    async (code: string) => {
      if (!user) return { ok: false, error: 'Log in first.' }
      const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
      if (!normalized) return { ok: false, error: 'Enter a subscription key.' }

      const current = expireStaleSubscriptions(loadDatabase())
      const record = current.keys.find((k) => k.code.toUpperCase() === normalized)
      if (!record) return { ok: false, error: 'Invalid key. Check the code and try again.' }
      if (record.status === 'revoked') return { ok: false, error: 'This key has been revoked.' }
      if (record.status === 'redeemed') {
        return { ok: false, error: 'This key was already used.' }
      }

      const redeemedAt = Date.now()
      const planExpiresAt = computeExpiry(record.plan, redeemedAt)

      const keys = current.keys.map((k) =>
        k.code === record.code
          ? {
              ...k,
              status: 'redeemed' as const,
              redeemedBy: user.id,
              redeemedAt,
              expiresAt: planExpiresAt,
            }
          : k,
      )
      const users = current.users.map((u) =>
        u.id === user.id
          ? {
              ...u,
              plan: record.plan,
              licenseKey: record.code,
              planExpiresAt,
              role: record.plan === 'lifetime' ? ('ceo' as const) : u.role,
            }
          : u,
      )
      persist({ ...current, keys, users })
      return { ok: true, plan: record.plan }
    },
    [user, persist],
  )

  const recordPhotosUsed = useCallback(
    (count: number) => {
      if (!user || count <= 0) return
      if (isSubscriptionActive(user.plan, user.planExpiresAt)) return
      const current = loadDatabase()
      const users = current.users.map((u) =>
        u.id === user.id ? { ...u, photosUsed: u.photosUsed + count } : u,
      )
      persist({ ...current, users })
    },
    [user, persist],
  )

  const generateKeys = useCallback(
    (plan: Exclude<PlanId, 'free'>, quantity: number, note = '') => {
      if (!user || user.role !== 'ceo') return []
      const qty = Math.min(50, Math.max(1, Math.round(quantity)))
      const current = loadDatabase()
      const created: LicenseKeyRecord[] = []
      for (let i = 0; i < qty; i++) {
        created.push(createLicenseRecord(plan, note))
      }
      persist({ ...current, keys: [...created, ...current.keys] })
      return created
    },
    [user, persist],
  )

  const revokeKey = useCallback(
    (code: string) => {
      if (!user || user.role !== 'ceo') return
      const current = loadDatabase()
      const keys = current.keys.map((k) =>
        k.code === code ? { ...k, status: 'revoked' as const } : k,
      )
      // If a user currently holds this key, drop them to free
      const users = current.users.map((u) =>
        u.licenseKey === code
          ? {
              ...u,
              plan: 'free' as const,
              licenseKey: null,
              planExpiresAt: null,
              role: u.name.toLowerCase() === CEO_NAME.toLowerCase() ? u.role : ('user' as const),
            }
          : u,
      )
      persist({ ...current, keys, users })
    },
    [user, persist],
  )

  const exportDb = useCallback(() => exportDatabaseJson(), [])

  const importDb = useCallback((raw: string) => {
    try {
      const next = importDatabaseJson(raw)
      setDb(expireStaleSubscriptions(next))
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Import failed.' }
    }
  }, [])

  const value: AuthContextValue = {
    ready: true,
    user,
    db,
    isLoggedIn: !!user,
    isCeo: user?.role === 'ceo',
    hasActiveSubscription,
    freeLimit: FREE_PHOTO_LIMIT,
    photosRemaining,
    canUploadCount,
    login,
    register,
    logout,
    redeemKey,
    recordPhotosUsed,
    generateKeys,
    revokeKey,
    exportDb,
    importDb,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
