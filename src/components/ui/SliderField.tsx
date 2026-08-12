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
  /** Shown in the numeric input (defaults to raw value). */
  inputDisplay?: (v: number) => string | number
  /** Parse the numeric input back to the slider value. */
  parseInput?: (raw: string) => number | null
  inputSuffix?: string
  trackClassName?: string
  disabled?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  hint?: ReactNode
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => v.toFixed(2),
  inputDisplay,
  parseInput,
  inputSuffix,
  trackClassName,
  disabled,
  leading,
  trailing,
  hint,
}: SliderFieldProps) {
  const shown = inputDisplay ? inputDisplay(value) : Number(value.toFixed(3))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-ink">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-16 rounded-md border border-line bg-panel px-2 py-1 text-right text-xs tabular-nums text-ink"
            value={shown}
            min={inputDisplay ? undefined : min}
            max={inputDisplay ? undefined : max}
            step={inputDisplay ? 1 : step}
            disabled={disabled}
            aria-label={`${label} value`}
            onChange={(e) => {
              const n = parseInput
                ? parseInput(e.target.value)
                : parseFloat(e.target.value)
              if (n == null || Number.isNaN(n)) return
              onChange(Math.min(max, Math.max(min, n)))
            }}
          />
          {inputSuffix ? (
            <span className="text-xs font-medium text-muted">{inputSuffix}</span>
          ) : null}
        </div>
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
      {hint}
    </div>
  )
}
