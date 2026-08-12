import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  Hand,
  Heart,
  Hexagon,
  Pencil,
  RotateCcw,
  RotateCw,
  ScanFace,
  Smile,
  Square,
  Squircle,
  Star,
  User,
  X,
} from 'lucide-react'
import { useStudio } from '../../store/StudioContext'
import { renderIntoCanvas, getOutputPixelSize } from '../../lib/renderPipeline'
import { SliderField } from '../ui/SliderField'
import { SHAPE_LABELS } from '../../lib/shapes'
import { PRESET_ORDER, PRESETS } from '../../lib/presets'
import { clsx } from '../../lib/utils'
import type { CenterMode, CropShape } from '../../types'

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

const ZOOM_PRESETS = [50, 70, 80, 100, 120, 150, 200]

interface ResultAdjustModalProps {
  resultId: string
  onClose: () => void
  onNavigate: (resultId: string) => void
}

export function ResultAdjustModal({
  resultId,
  onClose,
  onNavigate,
}: ResultAdjustModalProps) {
  const {
    state,
    setActive,
    updateSettings,
    ensureFaceCentered,
    recenterFace,
    recropResult,
    toast,
  } = useStudio()

  const resultIndex = state.results.findIndex((r) => r.id === resultId)
  const result = resultIndex >= 0 ? state.results[resultIndex] : null
  const image = result
    ? state.images.find((img) => img.id === result.imageId) ?? null
    : null
  const settings = image?.cropSettings ?? state.globalSettings

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  // Keep studio active image in sync with the result being edited
  useLayoutEffect(() => {
    if (!result?.imageId) return
    if (state.activeImageId === result.imageId) return
    setActive(result.imageId)
  }, [result?.imageId, state.activeImageId, setActive])

  const source = image?.previewBitmap ?? image?.sourceBitmap

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !source || !image) return
    const { width, height } = getOutputPixelSize(settings)
    const maxPreview = 560
    const scale = Math.min(1, maxPreview / Math.max(width, height))
    const outW = Math.max(64, Math.round(width * scale))
    const outH = Math.max(64, Math.round(height * scale))
    renderIntoCanvas(canvas, source, settings, {
      outputWidth: outW,
      outputHeight: outH,
      showOverlay: true,
      transparentBackground: false,
      backgroundColor: '#1e293b',
    })
  }, [source, image, settings])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!image) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      const zoom = Math.min(3, Math.max(0.5, settings.zoom + delta))
      updateSettings({ zoom }, { imageOnly: true })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [image, settings.zoom, updateSettings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && resultIndex > 0) {
        e.preventDefault()
        void goTo(resultIndex - 1)
      }
      if (e.key === 'ArrowRight' && resultIndex < state.results.length - 1) {
        e.preventDefault()
        void goTo(resultIndex + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultIndex, state.results.length, onClose])

  const patch = (next: Partial<typeof settings>) => {
    updateSettings(next, { imageOnly: true })
  }

  const saveCurrent = async () => {
    if (!result) return false
    setSaving(true)
    try {
      return await recropResult(result.id)
    } finally {
      setSaving(false)
    }
  }

  const goTo = async (index: number) => {
    const target = state.results[index]
    if (!target) return
    await saveCurrent()
    onNavigate(target.id)
  }

  const handleDone = async () => {
    const ok = await saveCurrent()
    if (ok) toast('success', 'Cropped result updated.')
    onClose()
  }

  const applyCenter = async (mode: CenterMode) => {
    if (!image) return
    if (mode === 'manual') {
      patch({ centerMode: 'manual' })
      return
    }
    setDetecting(true)
    try {
      const ok = await ensureFaceCentered(mode)
      if (!ok) {
        toast('warning', 'Face not detected — drag to position manually.')
      }
    } finally {
      setDetecting(false)
    }
  }

  const onRecenter = async () => {
    if (!image) return
    setDetecting(true)
    try {
      await recenterFace()
    } finally {
      setDetecting(false)
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !image || !canvasRef.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    const size = Math.min(canvasRef.current.width, canvasRef.current.height) || 1
    const nx = Math.min(1.2, Math.max(-0.2, settings.x + dx / size))
    const ny = Math.min(1.2, Math.max(-0.2, settings.y + dy / size))
    patch({ x: nx, y: ny, centerMode: 'manual' })
  }

  const onPointerUp = () => {
    dragging.current = false
  }

  if (!result || !image) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
        <div className="rounded-2xl bg-panel p-6 text-sm text-ink shadow-xl">
          Result not found.
          <button type="button" className="ml-3 underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const label = result.filename.replace(/\.[^.]+$/, '')
  const busy = saving || detecting

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust ${label}`}
    >
      <div className="flex max-h-[min(920px,96vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Pencil className="size-4 shrink-0 text-brand-700" />
            <h2 className="truncate font-display text-base font-semibold text-ink sm:text-lg">
              Adjust “{label}”
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm text-muted">
              {resultIndex + 1} / {state.results.length}
            </span>
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"
              aria-label="Close"
              onClick={() => void handleDone()}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="relative flex min-h-[280px] flex-col border-b border-line lg:border-b-0 lg:border-r">
            <div
              ref={wrapRef}
              className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-800/95 p-4"
            >
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-slate-900/70 p-2 text-white disabled:opacity-30"
                disabled={resultIndex <= 0 || busy}
                aria-label="Previous result"
                onClick={() => void goTo(resultIndex - 1)}
              >
                <ChevronLeft className="size-5" />
              </button>
              <canvas
                ref={canvasRef}
                className="max-h-[min(520px,58vh)] max-w-full cursor-grab touch-none rounded-lg active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                aria-label="Edit crop preview. Drag to pan, scroll to zoom."
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-slate-900/70 p-2 text-white disabled:opacity-30"
                disabled={resultIndex >= state.results.length - 1 || busy}
                aria-label="Next result"
                onClick={() => void goTo(resultIndex + 1)}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            <p className="border-t border-line px-4 py-2 text-center text-xs text-muted">
              Drag to pan · scroll to zoom · edits apply to this photo only until you save
            </p>
          </div>

          <div className="no-scrollbar min-h-0 space-y-4 overflow-y-auto p-4">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Shape
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium',
                      settings.shape === id
                        ? 'border-brand-600 bg-brand-700 text-white'
                        : 'border-line bg-surface text-ink hover:border-brand-400',
                    )}
                    onClick={() => patch({ shape: id })}
                  >
                    <Icon className="size-4" />
                    {SHAPE_LABELS[id]}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Centering
              </h3>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {CENTERS.map(({ id, label: centerLabel, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium',
                      settings.centerMode === id
                        ? 'border-brand-600 bg-brand-700 text-white'
                        : 'border-line bg-surface text-ink hover:border-brand-400',
                    )}
                    onClick={() => void applyCenter(id)}
                  >
                    <Icon className="size-4" />
                    {centerLabel}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy || settings.centerMode === 'manual'}
                className="mt-2 rounded-lg border border-brand-600/40 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-200"
                onClick={() => void onRecenter()}
              >
                Recenter Face
              </button>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Presets
                </h3>
                {settings.preset !== 'none' && (
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-danger"
                    disabled={busy}
                    onClick={() => patch({ preset: 'none' })}
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
                    disabled={busy}
                    className={clsx(
                      'rounded-lg border px-1 py-2 text-[11px] font-medium',
                      settings.preset === id
                        ? 'border-brand-600 bg-brand-700 text-white'
                        : 'border-line bg-surface text-ink hover:border-brand-400',
                    )}
                    onClick={() => patch({ preset: id })}
                  >
                    {PRESETS[id].label}
                  </button>
                ))}
              </div>
            </section>

            <SliderField
              label="Zoom"
              value={settings.zoom}
              min={0.5}
              max={3}
              step={0.01}
              disabled={busy}
              format={(v) => `${Math.round(v * 100)}%`}
              inputDisplay={(v) => Math.round(v * 100)}
              parseInput={(raw) => {
                const n = parseFloat(raw)
                return Number.isNaN(n) ? null : n / 100
              }}
              inputSuffix="%"
              hint={
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ZOOM_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={busy}
                      className={clsx(
                        'rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums',
                        Math.round(settings.zoom * 100) === pct
                          ? 'border-brand-600 bg-brand-700 text-white'
                          : 'border-line bg-surface text-ink hover:border-brand-400',
                      )}
                      onClick={() => patch({ zoom: pct / 100 })}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              }
              onChange={(zoom) => patch({ zoom })}
            />

            <SliderField
              label="Rotation"
              value={settings.rotation}
              min={-180}
              max={180}
              step={1}
              disabled={busy}
              format={(v) => `${Math.round(v)}°`}
              leading={
                <button
                  type="button"
                  className="rounded-md border border-line p-1.5"
                  aria-label="Rotate left"
                  disabled={busy}
                  onClick={() =>
                    patch({ rotation: Math.max(-180, settings.rotation - 90) })
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
                  disabled={busy}
                  onClick={() =>
                    patch({ rotation: Math.min(180, settings.rotation + 90) })
                  }
                >
                  <RotateCw className="size-3.5" />
                </button>
              }
              onChange={(rotation) => patch({ rotation })}
            />

            <SliderField
              label="Border"
              value={settings.border}
              min={0}
              max={20}
              step={0.1}
              disabled={busy}
              onChange={(border) => patch({ border })}
            />
            <SliderField
              label="Contrast"
              value={settings.contrast}
              min={0.5}
              max={2}
              disabled={busy}
              trackClassName="bg-gradient-to-r from-neutral-800 to-neutral-100"
              onChange={(contrast) => patch({ contrast, preset: 'none' })}
            />
            <SliderField
              label="Brightness"
              value={settings.brightness}
              min={0.5}
              max={2}
              disabled={busy}
              trackClassName="bg-gradient-to-r from-neutral-900 to-white"
              onChange={(brightness) => patch({ brightness, preset: 'none' })}
            />
            <SliderField
              label="Saturation"
              value={settings.saturation}
              min={0}
              max={2}
              disabled={busy}
              trackClassName="bg-gradient-to-r from-neutral-400 via-rose-400 via-40% via-amber-300 via-60% via-emerald-400 to-sky-400"
              onChange={(saturation) => patch({ saturation, preset: 'none' })}
            />
            <SliderField
              label="Vignette"
              value={settings.vignette}
              min={0}
              max={1}
              disabled={busy}
              trackClassName="bg-gradient-to-r from-neutral-200 to-neutral-900"
              onChange={(vignette) => patch({ vignette, preset: 'none' })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            {busy ? (detecting ? 'Detecting face…' : 'Saving…') : 'Changes update this result when you close or navigate.'}
          </p>
          <button
            type="button"
            className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-40"
            disabled={busy}
            onClick={() => void handleDone()}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
