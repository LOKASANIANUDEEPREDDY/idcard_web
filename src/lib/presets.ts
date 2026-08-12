import type { PresetId } from '../types'

export interface PresetValues {
  contrast: number
  brightness: number
  saturation: number
  vignette: number
}

export const PRESETS: Record<Exclude<PresetId, 'none'>, { label: string; values: PresetValues }> = {
  vivid: {
    label: 'Vivid',
    values: { contrast: 1.15, brightness: 1.05, saturation: 1.35, vignette: 0.05 },
  },
  bw: {
    label: 'B & W',
    values: { contrast: 1.1, brightness: 1.0, saturation: 0, vignette: 0.1 },
  },
  vintage: {
    label: 'Vintage',
    values: { contrast: 0.95, brightness: 1.05, saturation: 0.7, vignette: 0.35 },
  },
  natural: {
    label: 'Natural',
    values: { contrast: 1.05, brightness: 1.02, saturation: 1.05, vignette: 0 },
  },
  soft: {
    label: 'Soft',
    values: { contrast: 0.9, brightness: 1.08, saturation: 0.9, vignette: 0.08 },
  },
  airy: {
    label: 'Airy',
    values: { contrast: 0.85, brightness: 1.15, saturation: 0.85, vignette: 0 },
  },
  moody: {
    label: 'Moody',
    values: { contrast: 1.25, brightness: 0.9, saturation: 0.85, vignette: 0.45 },
  },
  cinema: {
    label: 'Cinema',
    values: { contrast: 1.2, brightness: 0.95, saturation: 0.75, vignette: 0.3 },
  },
}

export const PRESET_ORDER: Exclude<PresetId, 'none'>[] = [
  'vivid',
  'bw',
  'vintage',
  'natural',
  'soft',
  'airy',
  'moody',
  'cinema',
]
