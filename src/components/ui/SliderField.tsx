import type { ReactNode } from 'react'
import { clsx } from '../../lib/utils'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (v: number) => string
  trackClassName?: string
  disabled?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => v.toFixed(2),
  trackClassName,
  disabled,
  leading,
  trailing,
}: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-ink">{label}</label>
        <input
          type="number"
          className="w-16 rounded-md border border-line bg-panel px-2 py-1 text-right text-xs tabular-nums text-ink"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={`${label} value`}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        {leading}
        <input
          type="range"
          className={clsx('slider-track w-full', trackClassName)}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {trailing}
      </div>
    </div>
  )
}
