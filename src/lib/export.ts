import JSZip from 'jszip'
import type { CropSettings, ExportFormat, NamingMode, StudioImage } from '../types'
import { buildExportFilename } from './utils'
import { canvasToBlob, getOutputPixelSize, renderCroppedImage } from './renderPipeline'

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revoke after the browser has a chance to start the download
    setTimeout(() => URL.revokeObjectURL(url), 4_000)
  }
}

export async function renderExportBlob(
  image: StudioImage,
  exportOpts: {
    format: ExportFormat
    quality: number
    transparentBackground: boolean
    backgroundColor: string
  },
  settingsOverride?: CropSettings,
): Promise<Blob> {
  const source = image.sourceBitmap ?? image.previewBitmap
  if (!source) throw new Error('Missing image data')

  const settings = {
    ...(settingsOverride ?? image.cropSettings),
    transparentBackground: exportOpts.transparentBackground,
    backgroundColor: exportOpts.backgroundColor,
  }
  const { width, height } = getOutputPixelSize(settings)
  const canvas = renderCroppedImage(source, settings, {
    outputWidth: width,
    outputHeight: height,
    showOverlay: false,
    transparentBackground:
      exportOpts.format === 'png' ? exportOpts.transparentBackground : false,
    backgroundColor: exportOpts.backgroundColor,
  })
  return canvasToBlob(canvas, exportOpts.format, exportOpts.quality)
}

export async function downloadResultsAsZip(
  items: Array<{ image: StudioImage; originalName: string }>,
  options: {
    namingMode: NamingMode
    postfix: string
    format: ExportFormat
    quality: number
    transparentBackground: boolean
    backgroundColor: string
    zipName?: string
  },
): Promise<{ ok: number; failed: number }> {
  if (items.length === 0) {
    throw new Error('No images selected for download.')
  }

  const zip = new JSZip()
  const used = new Set<string>()
  let ok = 0
  let failed = 0

  for (const item of items) {
    try {
      const blob = await renderExportBlob(item.image, {
        format: options.format,
        quality: options.quality,
        transparentBackground: options.transparentBackground,
        backgroundColor: options.backgroundColor,
      })
      const name = buildExportFilename(
        item.originalName,
        options.namingMode,
        options.postfix,
        options.format,
        used,
      )
      zip.file(name, blob)
      ok += 1
    } catch {
      failed += 1
    }
  }

  if (ok === 0) {
    throw new Error('Some files could not be added to the ZIP.')
  }

  const content = await zip.generateAsync({ type: 'blob' })
  await downloadBlob(content, options.zipName || 'face-crop-studio-results.zip')
  return { ok, failed }
}
