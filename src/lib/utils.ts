import type { DimensionUnit } from '../types'

const MM_PER_INCH = 25.4
const DEFAULT_DPI = 300

export function toPixels(value: number, unit: DimensionUnit, dpi = DEFAULT_DPI): number {
  if (unit === 'px') return Math.round(value)
  if (unit === 'mm') return Math.round((value / MM_PER_INCH) * dpi)
  if (unit === 'cm') return Math.round((value / 2.54) * dpi)
  return Math.round(value)
}

export function fromPixels(px: number, unit: DimensionUnit, dpi = DEFAULT_DPI): number {
  if (unit === 'px') return px
  if (unit === 'mm') return (px / dpi) * MM_PER_INCH
  if (unit === 'cm') return (px / dpi) * 2.54
  return px
}

export function clampDimensions(width: number, height: number): { width: number; height: number } {
  const min = 16
  const max = 4096
  return {
    width: Math.min(max, Math.max(min, Math.round(width))),
    height: Math.min(max, Math.max(min, Math.round(height))),
  }
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180)
  return cleaned || 'image'
}

export function buildExportFilename(
  originalName: string,
  namingMode: 'original' | 'postfix',
  postfix: string,
  format: 'png' | 'jpeg' | 'webp',
  usedNames: Set<string>,
): string {
  const safe = sanitizeFilename(originalName)
  const ext = format === 'jpeg' ? 'jpg' : format
  const rawPostfix = postfix.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 40)
  let candidate =
    namingMode === 'postfix' ? `${safe}${rawPostfix || '_cropped'}.${ext}` : `${safe}.${ext}`

  if (!usedNames.has(candidate.toLowerCase())) {
    usedNames.add(candidate.toLowerCase())
    return candidate
  }

  let i = 2
  while (usedNames.has(candidate.toLowerCase())) {
    const stem =
      namingMode === 'postfix'
        ? `${safe}${rawPostfix || '_cropped'}_${i}`
        : `${safe}_${i}`
    candidate = `${stem}.${ext}`
    i += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

export function createId(prefix = 'img'): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
