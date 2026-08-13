export async function hashPin(pin: string, name: string): Promise<string> {
  const payload = `${name.trim().toLowerCase()}::${pin}`
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSegment(length = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomSegment(6).toLowerCase()}`
}
