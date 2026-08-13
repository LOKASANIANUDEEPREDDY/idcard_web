import { clsx } from '../../lib/utils'

export const BORDER_COLOR_PRESETS = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
] as const

interface ColorPaletteProps {
  label?: string
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  presets?: readonly string[]
}

export function ColorPalette({
  label = 'Border color',
  value,
  onChange,
  disabled,
  presets = BORDER_COLOR_PRESETS,
}: ColorPaletteProps) {
  const current = value || '#ffffff'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className="size-6 rounded-md border border-line shadow-sm"
            style={{ backgroundColor: current }}
            aria-hidden
          />
          <input
            type="color"
            className="h-8 w-10 cursor-pointer rounded border border-line bg-panel disabled:opacity-40"
            value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : '#ffffff'}
            disabled={disabled}
            aria-label={`${label} picker`}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className="w-[5.5rem] rounded-md border border-line bg-panel px-2 py-1 font-mono text-xs uppercase text-ink disabled:opacity-40"
            value={current}
            disabled={disabled}
            aria-label={`${label} hex`}
            maxLength={7}
            onChange={(e) => {
              const next = e.target.value.startsWith('#')
                ? e.target.value
                : `#${e.target.value}`
              if (/^#[0-9a-fA-F]{0,6}$/.test(next)) onChange(next)
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            disabled={disabled}
            title={color}
            aria-label={`Set ${label} to ${color}`}
            className={clsx(
              'size-7 rounded-md border-2 shadow-sm transition disabled:opacity-40',
              current.toLowerCase() === color.toLowerCase()
                ? 'border-brand-600 ring-2 ring-brand-600/30'
                : 'border-line hover:scale-105',
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  )
}
