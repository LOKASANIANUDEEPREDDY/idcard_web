import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudio } from '../../store/StudioContext'
import { renderIntoCanvas, getOutputPixelSize } from '../../lib/renderPipeline'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { clsx } from '../../lib/utils'
import { FACE_FRAMING } from '../../lib/faceDetection'

export function LivePreview() {
  const {
    activeImage,
    selectedImages,
    updateSettings,
    applyToSelected,
    cropSelected,
    state,
  } = useStudio()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [confirmApply, setConfirmApply] = useState(false)
  const [applying, setApplying] = useState(false)

  const settings = activeImage?.cropSettings ?? state.globalSettings
  const source = activeImage?.previewBitmap ?? activeImage?.sourceBitmap

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !source || !activeImage) return

    const { width, height } = getOutputPixelSize(settings)
    const maxPreview = 520
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

    if (state.showDetectionOverlay && activeImage.faceDetection?.boundingBox) {
      drawDetectionOverlay(
        canvas,
        settings,
        activeImage.faceDetection.boundingBox,
        { width: outW, height: outH },
        { width: activeImage.width, height: activeImage.height },
      )
    }
  }, [activeImage, source, settings, state.showDetectionOverlay])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheelNative = (e: WheelEvent) => {
      if (!activeImage) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      const zoom = Math.min(3, Math.max(0.5, settings.zoom + delta))
      updateSettings({ zoom }, { imageOnly: true })
    }
    el.addEventListener('wheel', onWheelNative, { passive: false })
    return () => el.removeEventListener('wheel', onWheelNative)
  }, [activeImage, settings.zoom, updateSettings])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!activeImage) return
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !activeImage || !canvasRef.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    const size = Math.min(canvasRef.current.width, canvasRef.current.height) || 1
    const nx = Math.min(1.2, Math.max(-0.2, settings.x + dx / size))
    const ny = Math.min(1.2, Math.max(-0.2, settings.y + dy / size))
    updateSettings({ x: nx, y: ny, centerMode: 'manual' }, { imageOnly: true })
  }

  const onPointerUp = () => {
    dragging.current = false
  }

  const selectedCount = selectedImages.length
  const cropLabel =
    selectedCount === 0
      ? 'Crop Images'
      : selectedCount === 1
        ? 'Crop 1 Image'
        : `Crop ${selectedCount} Images`

  const busy =
    state.processing.isProcessing || state.detectionProgress.isProcessing || applying

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-base font-semibold text-ink">Live Preview</h2>
        <div className="flex items-center gap-2">
          {activeImage?.faceDetection?.detected && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Face locked
            </span>
          )}
          {activeImage?.hasOverride && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Manual override
            </span>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-800/90 p-4"
      >
        {!activeImage ? (
          <p className="text-sm text-slate-300">Select an image to preview the crop</p>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-h-[min(520px,55vh)] max-w-full cursor-grab touch-none rounded-lg active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Crop preview. Drag to pan, scroll to zoom."
          />
        )}
      </div>

      <p className="border-t border-line px-4 py-2 text-center text-xs text-muted">
        Drag to pan, scroll to zoom. Apply Settings recalculates face position per image.
      </p>

      <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row">
        <button
          type="button"
          className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-40"
          disabled={selectedCount === 0 || busy}
          onClick={() => setConfirmApply(true)}
        >
          Apply Settings to All
        </button>
        <button
          type="button"
          className={clsx(
            'flex-[1.4] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40',
            'bg-brand-700 hover:bg-brand-800',
          )}
          disabled={selectedCount === 0 || busy}
          onClick={() => void cropSelected()}
        >
          {state.processing.isProcessing
            ? state.processing.message || 'Cropping…'
            : cropLabel}
        </button>
      </div>

      {(state.processing.isProcessing || state.detectionProgress.isProcessing) && (
        <div className="px-4 pb-4">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{
                width: `${Math.round(
                  ((state.processing.isProcessing
                    ? state.processing.current
                    : state.detectionProgress.current) /
                    Math.max(
                      1,
                      state.processing.isProcessing
                        ? state.processing.total
                        : state.detectionProgress.total,
                    )) *
                    100,
                )}%`,
              }}
            />
          </div>
          <p className="mt-1 text-center text-xs text-muted">
            {state.processing.isProcessing
              ? state.processing.message
              : state.detectionProgress.message}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmApply}
        title="Apply settings to selected images?"
        description={`Apply crop settings to ${selectedCount} selected image${selectedCount === 1 ? '' : 's'}? Face centering recalculates position and zoom independently for each photo — coordinates are never copied between images.`}
        confirmLabel="Apply"
        onCancel={() => setConfirmApply(false)}
        onConfirm={() => {
          setConfirmApply(false)
          setApplying(true)
          void applyToSelected().finally(() => setApplying(false))
        }}
      />
    </div>
  )
}

/** Debug-only overlay — never included in exports. */
function drawDetectionOverlay(
  canvas: HTMLCanvasElement,
  settings: { x: number; y: number; zoom: number; rotation: number },
  box: { x: number; y: number; width: number; height: number },
  output: { width: number; height: number },
  sourceSize: { width: number; height: number },
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const srcW = sourceSize.width
  const srcH = sourceSize.height

  const coverScale =
    Math.max(output.width / srcW, output.height / srcH) * settings.zoom
  const drawW = srcW * coverScale
  const drawH = srcH * coverScale
  const cx = output.width * settings.x
  const cy = output.height * settings.y

  const toCanvas = (nx: number, ny: number) => {
    const sx = (nx - 0.5) * drawW
    const sy = (ny - 0.5) * drawH
    const rad = (settings.rotation * Math.PI) / 180
    const rx = sx * Math.cos(rad) - sy * Math.sin(rad)
    const ry = sx * Math.sin(rad) + sy * Math.cos(rad)
    return { x: cx + rx, y: cy + ry }
  }

  const tl = toCanvas(box.x, box.y)
  const br = toCanvas(box.x + box.width, box.y + box.height)
  const center = toCanvas(box.x + box.width / 2, box.y + box.height / 2)

  ctx.save()
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.95)'
  ctx.lineWidth = 2
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)

  ctx.fillStyle = 'rgba(45, 212, 191, 0.95)'
  ctx.beginPath()
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2)
  ctx.fill()

  const tx = output.width * FACE_FRAMING.targetFaceX
  const ty = output.height * FACE_FRAMING.targetFaceY
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)'
  ctx.beginPath()
  ctx.moveTo(tx - 8, ty)
  ctx.lineTo(tx + 8, ty)
  ctx.moveTo(tx, ty - 8)
  ctx.lineTo(tx, ty + 8)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '11px sans-serif'
  ctx.fillText('face', tl.x, Math.max(12, tl.y - 4))
  ctx.restore()
}
