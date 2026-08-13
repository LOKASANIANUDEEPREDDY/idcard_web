import type { AuthDatabase, AuthUser } from './types'

/** Canonical unique username key (case/space insensitive). */
export function toNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function findUserByName(db: AuthDatabase, name: string): AuthUser | null {
  const key = toNameKey(name)
  if (!key) return null
  return (
    db.users.find((u) => (u.nameKey || toNameKey(u.name)) === key) ?? null
  )
}

/** Keep earliest account per nameKey; drop later duplicates. */
export function dedupeUsersByName(users: AuthUser[]): {
  users: AuthUser[]
  removed: number
} {
  const seen = new Map<string, AuthUser>()
  const ordered = [...users].sort((a, b) => a.createdAt - b.createdAt)

  for (const user of ordered) {
    const key = user.nameKey || toNameKey(user.name)
    const normalized: AuthUser = { ...user, nameKey: key }
    if (!seen.has(key)) {
      seen.set(key, normalized)
    }
  }

  const next = Array.from(seen.values())
  return { users: next, removed: users.length - next.length }
}

export function isUsernameTaken(db: AuthDatabase, name: string): boolean {
  return !!findUserByName(db, name)
}
