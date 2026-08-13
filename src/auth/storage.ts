import type { AuthDatabase } from './types'

const DB_KEY = 'fcs-auth-db-v1'
const SESSION_KEY = 'fcs-auth-session-v1'

export function loadDatabase(): AuthDatabase {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return { version: 1, users: [], keys: [] }
    const parsed = JSON.parse(raw) as AuthDatabase
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.keys)) {
      return { version: 1, users: [], keys: [] }
    }
    return parsed
  } catch {
    return { version: 1, users: [], keys: [] }
  }
}

export function saveDatabase(db: AuthDatabase) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function loadSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function saveSessionUserId(userId: string | null) {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function exportDatabaseJson(): string {
  return JSON.stringify(loadDatabase(), null, 2)
}

export function importDatabaseJson(raw: string): AuthDatabase {
  const parsed = JSON.parse(raw) as AuthDatabase
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.keys)) {
    throw new Error('Invalid auth database file.')
  }
  saveDatabase(parsed)
  return parsed
}
