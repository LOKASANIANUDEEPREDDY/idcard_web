import { useState } from 'react'
import {
  Circle,
  Square,
  Squircle,
  Heart,
  Star,
  Hexagon,
  Plus,
  ScanFace,
  User,
  Eye,
  Smile,
  Hand,
  Lock,
  Unlock,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Redo2,
} from 'lucide-react'
import { useStudio } from '../../store/StudioContext'
import { SliderField } from '../ui/SliderField'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { SHAPE_LABELS } from '../../lib/shapes'
import { PRESET_ORDER, PRESETS } from '../../lib/presets'
import { clampDimensions, clsx } from '../../lib/utils'
import type { CenterMode, CropShape, CustomShapeConfig, DimensionUnit } from '../../types'

const SHAPES: { id: CropShape; icon: typeof Circle }[] = [
  { id: 'circle', icon: Circle },
  { id: 'square', icon: Square },
  { id: 'rounded', icon: Squircle },
  { id: 'heart', icon: Heart },
  { id: 'star', icon: Star },
  { id: 'hexagon', icon: Hexagon },
  { id: 'curvedHex', icon: Hexagon },
]

const CENTERS: { id: CenterMode; label: string; icon: typeof ScanFace }[] = [
  { id: 'face', label: 'Face', icon: ScanFace },
  { id: 'shoulders', label: 'Shoulders', icon: User },
  { id: 'eyes', label: 'Eyes', icon: Eye },
  { id: 'nose', label: 'Nose', icon: Smile },
  { id: 'manual', label: 'Manual', icon: Hand },
]

export function CropSettings() {
  const {
    state,
    activeImage,
    updateSettings,
    ensureFaceCentered,
    recenterFace,
    setShowDetectionOverlay,
    resetSettings,
    undo,
    redo,
    canUndo,
    canRedo,
    toast,
  } = useStudio()
  const [confirmReset, setConfirmReset] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customPath, setCustomPath] = useState('M0.5 0.05 L0.95 0.35 L0.8 0.9 L0.2 0.9 L0.05 0.35 Z')
  const [customName, setCustomName] = useState('Custom')
  const [detecting, setDetecting] = useState(false)

  const settings = activeImage?.cropSettings ?? state.globalSettings
  const disabled = !activeImage || detecting

  const applyCenter = async (mode: CenterMode) => {
    if (!activeImage) {
      updateSettings({ centerMode: mode })
      return
    }
    if (mode === 'manual') {
      updateSettings({ centerMode: 'manual' }, { imageOnly: true })
      return
    }

    setDetecting(true)
    try {
      const ok = await ensureFaceCentered(mode)
      if (!ok) {
        toast(
          'warning',
          'Face not detected — using manual center. Drag to position the crop.',
        )
      }
    } finally {
      setDetecting(false)
    }
  }

  const onRecenter = async () => {
    setDetecting(true)
    try {
      await recenterFace()
    } finally {
      setDetecting(false)
    }
  }

  const onDimensionChange = ( wh: 'width' | 'height', value: number) => {
    const next = { ...settings, [wh]: value }
    if (settings.aspectLocked) {
      const ratio = settings.width / settings.height || 1
      if (wh === 'width') next.height = value / ratio
      else next.width = value * ratio
    }
    const clamped = clampDimensions(next.width, next.height)
    // Keep display units values (not forcing px)
    updateSettings({
      width: settings.unit === 'px' ? clamped.width : Math.max(0.1, next.width),
      height: settings.unit === 'px' ? clamped.height : Math.max(0.1, next.height),
    })
  }

  const saveCustom = () => {
    const config: CustomShapeConfig = {
      type: 'svg',
      path: customPath.trim(),
      name: customName.trim() || 'Custom',
    }
    updateSettings({ shape: 'custom', customShape: config })
    setCustomOpen(false)
    toast('success', 'Custom shape applied.')
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-base font-semibold text-ink">Crop Settings</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-surface disabled:opacity-30"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-surface disabled:opacity-30"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 className="size-4" />
          </button>
          <button
            type="button"
            className="ml-1 inline-flex items-center gap-1 rounded-lg border border-danger/30 px-2 py-1 text-xs font-medium text-danger hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 className="size-3.5" />
            Reset All
          </button>
        </div>
      </div>

      <div className={clsx('no-scrollbar flex-1 space-y-5 overflow-y-auto p-4', disabled && 'opacity-60')}>
        {/* Shape */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shape</h3>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4">
            {SHAPES.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                className={clsx(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition',
                  settings.shape === id
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-line bg-surface text-ink hover:border-brand-400',
                )}
                onClick={() => updateSettings({ shape: id })}
              >
                <Icon className="size-4" />
                {SHAPE_LABELS[id]}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-lg border border-dashed px-1 py-2 text-[11px] font-medium',
                settings.shape === 'custom'
                  ? 'border-brand-600 bg-brand-700 text-white'
                  : 'border-line text-muted hover:border-brand-400',
              )}
              onClick={() => setCustomOpen(true)}
            >
              <Plus className="size-4" />
              Add Custom
            </button>
          </div>
        </section>

        {/* Centering */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Centering
          </h3>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {CENTERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                className={clsx(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium',
                  settings.centerMode === id
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-line bg-surface text-ink hover:border-brand-400',
                )}
                onClick={() => void applyCenter(id)}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          {detecting && (
            <p className="mt-2 text-xs text-muted animate-pulse-soft">Detecting face…</p>
          )}
          {activeImage?.faceDetection && !detecting && (
            <p className="mt-2 text-xs text-muted">
              {activeImage.faceDetection.status === 'detected' && (
                <>
                  Face detected
                  {activeImage.faceDetection.confidence
                    ? ` · ${Math.round(activeImage.faceDetection.confidence * 100)}%`
                    : ''}
                  {activeImage.faceDetection.multipleFaces ? ' · largest of multiple' : ''}
                  <span className="ml-1 tabular-nums text-ink/70">
                    · pan {settings.x.toFixed(2)},{settings.y.toFixed(2)} · zoom{' '}
                    {settings.zoom.toFixed(2)}
                  </span>
                </>
              )}
              {activeImage.faceDetection.status === 'not_detected' && 'Face not detected'}
              {activeImage.faceDetection.status === 'low_confidence' && 'Low-confidence detection'}
              {activeImage.faceDetection.status === 'detecting' && 'Detecting…'}
              {activeImage.faceDetection.status === 'error' && 'Detection error'}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || settings.centerMode === 'manual'}
              className="rounded-lg border border-brand-600/40 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-200 dark:hover:bg-brand-950/40"
              onClick={() => void onRecenter()}
            >
              Recenter Face
            </button>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={state.showDetectionOverlay}
                onChange={(e) => setShowDetectionOverlay(e.target.checked)}
              />
              Show detection
            </label>
          </div>
        </section>

        {/* Dimensions */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Output Dimensions
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Width
              <input
                type="number"
                disabled={disabled}
                className="w-24 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink"
                value={settings.width}
                min={1}
                onChange={(e) => onDimensionChange('width', parseFloat(e.target.value) || 1)}
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              className="mb-0.5 rounded-lg border border-line p-2 text-ink hover:bg-surface"
              aria-label={settings.aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              onClick={() => updateSettings({ aspectLocked: !settings.aspectLocked })}
            >
              {settings.aspectLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
            </button>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Height
              <input
                type="number"
                disabled={disabled}
                className="w-24 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink"
                value={settings.height}
                min={1}
                onChange={(e) => onDimensionChange('height', parseFloat(e.target.value) || 1)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Unit
              <select
                disabled={disabled}
                className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink"
                value={settings.unit}
                onChange={(e) => updateSettings({ unit: e.target.value as DimensionUnit })}
              >
                <option value="px">px</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
              </select>
            </label>
          </div>
        </section>

        {/* Presets */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Presets</h3>
            {settings.preset !== 'none' && (
              <button
                type="button"
                className="text-xs text-muted hover:text-danger"
                disabled={disabled}
                onClick={() => updateSettings({ preset: 'none' })}
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                className={clsx(
                  'rounded-lg border px-1 py-2 text-[11px] font-medium',
                  settings.preset === id
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-line bg-surface text-ink hover:border-brand-400',
                )}
                onClick={() => updateSettings({ preset: id })}
              >
                {PRESETS[id].label}
              </button>
            ))}
          </div>
        </section>

        {/* Sliders */}
        <SliderField
          label="Zoom"
          value={settings.zoom}
          min={0.5}
          max={3}
          step={0.01}
          disabled={disabled}
          onChange={(zoom) => updateSettings({ zoom }, { imageOnly: true })}
        />

        <SliderField
          label="Rotation"
          value={settings.rotation}
          min={-180}
          max={180}
          step={1}
          disabled={disabled}
          format={(v) => `${Math.round(v)}°`}
          leading={
            <button
              type="button"
              className="rounded-md border border-line p-1.5"
              aria-label="Rotate left"
              disabled={disabled}
              onClick={() =>
                updateSettings(
                  { rotation: Math.max(-180, settings.rotation - 90) },
                  { imageOnly: true },
                )
              }
            >
              <RotateCcw className="size-3.5" />
            </button>
          }
          trailing={
            <button
              type="button"
              className="rounded-md border border-line p-1.5"
              aria-label="Rotate right"
              disabled={disabled}
              onClick={() =>
                updateSettings(
                  { rotation: Math.min(180, settings.rotation + 90) },
                  { imageOnly: true },
                )
              }
            >
              <RotateCw className="size-3.5" />
            </button>
          }
          onChange={(rotation) => updateSettings({ rotation }, { imageOnly: true })}
        />

        <SliderField
          label="Border"
          value={settings.border}
          min={0}
          max={20}
          step={0.1}
          disabled={disabled}
          onChange={(border) => updateSettings({ border })}
        />

        <SliderField
          label="Contrast"
          value={settings.contrast}
          min={0.5}
          max={2}
          disabled={disabled}
          trackClassName="bg-gradient-to-r from-neutral-800 to-neutral-100"
          onChange={(contrast) => updateSettings({ contrast, preset: 'none' })}
        />

        <SliderField
          label="Brightness"
          value={settings.brightness}
          min={0.5}
          max={2}
          disabled={disabled}
          trackClassName="bg-gradient-to-r from-neutral-900 to-white"
          onChange={(brightness) => updateSettings({ brightness, preset: 'none' })}
        />

        <SliderField
          label="Saturation"
          value={settings.saturation}
          min={0}
          max={2}
          disabled={disabled}
          trackClassName="bg-gradient-to-r from-neutral-400 via-rose-400 via-40% via-amber-300 via-60% via-emerald-400 to-sky-400"
          onChange={(saturation) => updateSettings({ saturation, preset: 'none' })}
        />

        <SliderField
          label="Vignette"
          value={settings.vignette}
          min={0}
          max={1}
          disabled={disabled}
          trackClassName="bg-gradient-to-r from-neutral-200 to-neutral-900"
          onChange={(vignette) => updateSettings({ vignette, preset: 'none' })}
        />
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all settings?"
        description="Crop shape, dimensions, adjustments, and positions will return to defaults. Uploaded images will not be deleted."
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetSettings()
          setConfirmReset(false)
        }}
      />

      {customOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5 shadow-xl">
            <h3 className="font-display text-lg font-semibold">Custom Shape</h3>
            <p className="mt-1 text-sm text-muted">
              Enter an SVG path using normalized 0–1 coordinates, or a polygon path.
            </p>
            <label className="mt-4 block text-xs font-medium text-muted">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-muted">
              SVG Path
              <textarea
                className="mt-1 h-28 w-full rounded-lg border border-line px-3 py-2 font-mono text-xs text-ink"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-line px-4 py-2 text-sm"
                onClick={() => setCustomOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={saveCustom}
              >
                Apply Shape
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
