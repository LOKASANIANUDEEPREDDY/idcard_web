import type { CropSettings, ExportFormat } from '../types'
import { createShapePath } from './shapes'
import { toPixels } from './utils'

export interface RenderOptions {
  outputWidth: number
  outputHeight: number
  showOverlay?: boolean
  overlayOpacity?: number
  transparentBackground?: boolean
  backgroundColor?: string
}

/**
 * Shared rendering pipeline used by live preview and export.
 * source → transform → crop → adjustments → mask → border → output
 */
export function renderCroppedImage(
  source: CanvasImageSource,
  settings: CropSettings,
  options: RenderOptions,
): HTMLCanvasElement {
  const {
    outputWidth,
    outputHeight,
    showOverlay = false,
    overlayOpacity = 0.45,
    transparentBackground = settings.transparentBackground,
    backgroundColor = settings.backgroundColor,
  } = options

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Canvas not supported')

  if (!transparentBackground) {
    ctx.fillStyle = backgroundColor || '#ffffff'
    ctx.fillRect(0, 0, outputWidth, outputHeight)
  } else {
    ctx.clearRect(0, 0, outputWidth, outputHeight)
  }

  const srcW =
    'naturalWidth' in source && (source as HTMLImageElement).naturalWidth
      ? (source as HTMLImageElement).naturalWidth
      : (source as ImageBitmap).width
  const srcH =
    'naturalHeight' in source && (source as HTMLImageElement).naturalHeight
      ? (source as HTMLImageElement).naturalHeight
      : (source as ImageBitmap).height

  const content = document.createElement('canvas')
  content.width = outputWidth
  content.height = outputHeight
  const cctx = content.getContext('2d')
  if (!cctx) throw new Error('Canvas not supported')

  const coverScale =
    Math.max(outputWidth / srcW, outputHeight / srcH) * settings.zoom
  const drawW = srcW * coverScale
  const drawH = srcH * coverScale
  const cx = outputWidth * settings.x
  const cy = outputHeight * settings.y

  const { contrast, brightness, saturation } = settings
  const needsFilter = contrast !== 1 || brightness !== 1 || saturation !== 1

  cctx.save()
  cctx.translate(cx, cy)
  cctx.rotate((settings.rotation * Math.PI) / 180)
  // Canvas CSS filters are reliable and avoid getImageData wiping adjustments
  if (needsFilter) {
    cctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
  }
  cctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH)
  cctx.filter = 'none'
  cctx.restore()

  if (settings.vignette > 0) {
    applyVignette(cctx, outputWidth, outputHeight, settings.vignette)
  }

  const borderWidth =
    settings.border > 0
      ? Math.max(
          1,
          settings.border * (Math.min(outputWidth, outputHeight) / 100),
        )
      : 0
  // Keep the outer silhouette just inside the canvas so edges aren't clipped.
  const safetyInset = 1
  const mask = createShapePath(
    settings.shape,
    outputWidth,
    outputHeight,
    settings.customShape,
    safetyInset,
  )

  ctx.save()
  ctx.clip(mask)
  ctx.drawImage(content, 0, 0)

  if (borderWidth > 0) {
    // Inside border only: stroke is centered on the path, so doubling the
    // width and keeping the clip discards the outer half — border stays
    // entirely inside the photo's outer line.
    ctx.lineWidth = borderWidth * 2
    ctx.strokeStyle = settings.borderColor || '#ffffff'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke(mask)
  }
  ctx.restore()

  if (showOverlay) {
    const overlay = document.createElement('canvas')
    overlay.width = outputWidth
    overlay.height = outputHeight
    const octx = overlay.getContext('2d')
    if (octx) {
      octx.fillStyle = `rgba(15, 23, 42, ${overlayOpacity})`
      octx.fillRect(0, 0, outputWidth, outputHeight)
      octx.globalCompositeOperation = 'destination-out'
      octx.fill(mask)
      ctx.drawImage(overlay, 0, 0)

      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = Math.max(1.5, Math.min(outputWidth, outputHeight) * 0.004)
      ctx.stroke(mask)
    }
  }

  return canvas
}

function applyVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  amount: number,
) {
  const cx = w / 2
  const cy = h / 2
  const inner = Math.min(w, h) * 0.25
  const outer = Math.hypot(cx, cy)
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(1, amount * 0.85)})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

export function getOutputPixelSize(settings: CropSettings): {
  width: number
  height: number
} {
  return {
    width: toPixels(settings.width, settings.unit),
    height: toPixels(settings.height, settings.unit),
  }
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const mime =
    format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
  const q = format === 'png' ? undefined : Math.max(0.01, Math.min(1, quality / 100))

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Unable to export this image. Try again.'))
        else resolve(blob)
      },
      mime,
      q,
    )
  })
}

export function renderIntoCanvas(
  target: HTMLCanvasElement,
  source: CanvasImageSource,
  settings: CropSettings,
  options: RenderOptions,
) {
  const rendered = renderCroppedImage(source, settings, options)
  target.width = rendered.width
  target.height = rendered.height
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(rendered, 0, 0)
}
