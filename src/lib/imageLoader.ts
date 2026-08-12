import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
  PREVIEW_MAX_EDGE,
  type CropSettings,
  type FaceDetection,
  type FaceLandmark,
} from '../types'
import {
  applyFaceCentering,
  detectFace,
  prefetchFaceModel,
} from './faceDetection'
import { toPixels } from './utils'

export {
  detectFace,
  detectFaceLandmark,
  centerFromFace,
  prefetchFaceModel,
  calculateFaceCropPosition,
  applyFaceCentering,
  emptyFaceDetection,
  FACE_FRAMING,
} from './faceDetection'

export interface LoadedImageData {
  bitmap: ImageBitmap
  previewBitmap: ImageBitmap
  width: number
  height: number
  previewUrl: string
  face: FaceLandmark | null
  faceDetection: FaceDetection
}

export function isAcceptedFile(file: File): boolean {
  const typeOk = ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  const extOk = ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])
  return typeOk || extOk
}

export async function loadImageFile(file: File): Promise<LoadedImageData> {
  if (!isAcceptedFile(file)) {
    throw new Error('Unsupported image format. Please upload JPG, JPEG, PNG, or WEBP.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (max ${MAX_FILE_SIZE / (1024 * 1024)} MB).`)
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    })
  } catch {
    throw new Error('This image could not be processed.')
  }

  if (bitmap.width < 16 || bitmap.height < 16) {
    bitmap.close()
    throw new Error('Image is too small to process.')
  }

  const previewBitmap = await createPreviewBitmap(bitmap)
  const canvas = document.createElement('canvas')
  canvas.width = previewBitmap.width
  canvas.height = previewBitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    previewBitmap.close()
    throw new Error('Unable to create preview.')
  }
  ctx.drawImage(previewBitmap, 0, 0)
  const previewUrl = canvas.toDataURL('image/jpeg', 0.72)

  let faceDetection = await detectFace(previewBitmap)
  if (!faceDetection.detected) {
    const full = await detectFace(bitmap)
    if (full.detected || full.status === 'low_confidence') {
      faceDetection = full
    }
  }

  return {
    bitmap,
    previewBitmap,
    width: bitmap.width,
    height: bitmap.height,
    previewUrl,
    face: faceDetection.boundingBox,
    faceDetection,
  }
}

/** Apply face centering into crop settings using shared math (preview + export). */
export function settingsFromFaceDetection(
  base: CropSettings,
  faceDetection: FaceDetection,
  srcW: number,
  srcH: number,
  adjustZoom = true,
): CropSettings {
  const outputW = toPixels(base.width, base.unit)
  const outputH = toPixels(base.height, base.unit)
  const result = applyFaceCentering({
    detection: faceDetection,
    mode: base.centerMode,
    srcW,
    srcH,
    outputW,
    outputH,
    adjustZoom,
    currentZoom: base.zoom,
  })

  if (!result.applied) {
    return {
      ...base,
      x: 0.5,
      y: 0.5,
    }
  }

  return {
    ...base,
    centerMode: result.centerMode,
    x: result.x,
    y: result.y,
    zoom: result.zoom,
  }
}

async function createPreviewBitmap(source: ImageBitmap): Promise<ImageBitmap> {
  const maxEdge = Math.max(source.width, source.height)
  if (maxEdge <= PREVIEW_MAX_EDGE) {
    return createImageBitmap(source)
  }
  const scale = PREVIEW_MAX_EDGE / maxEdge
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  return createImageBitmap(source, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: 'high',
  })
}

export function revokeIfObjectUrl(url: string | null | undefined) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

if (typeof window !== 'undefined') {
  prefetchFaceModel()
}
