import type { CenterMode, FaceDetection, FaceLandmark } from '../types'

/** Tunable ID-photo framing targets (normalized crop space). */
export const FACE_FRAMING = {
  /** Horizontal face target in the crop (0.5 = center). */
  targetFaceX: 0.5,
  /** Vertical face target — slightly above center for ID photos. */
  targetFaceY: 0.42,
  /** Eyes mode vertical target. */
  targetEyesY: 0.36,
  /** Nose mode vertical target. */
  targetNoseY: 0.48,
  /** Shoulders mode: place face higher so shoulders fill lower area. */
  targetShouldersY: 0.32,
  /** Face height as fraction of crop height (ID-style). */
  targetFaceHeightRatio: 0.42,
  /** Min/max auto zoom derived from face size. */
  minZoom: 0.55,
  maxZoom: 2.4,
  /** Ignore detections below this confidence. */
  confidenceThreshold: 0.5,
  /** Extra headroom above the face box as fraction of face height. */
  headroomFactor: 0.35,
} as const

type BlazeFaceModel = {
  estimateFaces: (
    input: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    returnTensors?: boolean,
  ) => Promise<
    Array<{
      topLeft: [number, number] | Float32Array
      bottomRight: [number, number] | Float32Array
      probability?: number[] | Float32Array
    }>
  >
}

let modelPromise: Promise<BlazeFaceModel | null> | null = null
let modelFailed = false

function getSourceSize(source: ImageBitmap | HTMLCanvasElement | HTMLImageElement): {
  width: number
  height: number
} {
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    }
  }
  return { width: source.width, height: source.height }
}

function toDetectionCanvas(
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): { canvas: HTMLCanvasElement; scale: number } {
  const { width, height } = getSourceSize(source)
  const maxEdge = 640
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(source, 0, 0, w, h)
  return { canvas, scale }
}

async function loadBlazeFace(): Promise<BlazeFaceModel | null> {
  if (modelFailed) return null
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        await tf.ready()
        try {
          await tf.setBackend('webgl')
          await tf.ready()
        } catch {
          await tf.setBackend('cpu')
          await tf.ready()
        }
        const blazeface = await import('@tensorflow-models/blazeface')
        // Detect multiple so we can pick the largest deterministically
        const model = await blazeface.load({ maxFaces: 5 })
        return model as unknown as BlazeFaceModel
      } catch (err) {
        console.warn('BlazeFace model failed to load:', err)
        modelFailed = true
        return null
      }
    })()
  }
  return modelPromise
}

function boxArea(b: FaceLandmark): number {
  return Math.max(0, b.width) * Math.max(0, b.height)
}

function pickBestFace(faces: FaceLandmark[]): {
  face: FaceLandmark
  multiple: boolean
} {
  const sorted = [...faces].sort((a, b) => {
    const areaDiff = boxArea(b) - boxArea(a)
    if (Math.abs(areaDiff) > 1e-6) return areaDiff
    return (b.confidence ?? 0) - (a.confidence ?? 0)
  })
  return { face: sorted[0], multiple: faces.length > 1 }
}

async function detectNativeAll(
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceLandmark[]> {
  try {
    const FaceDetectorCtor = (
      window as unknown as {
        FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (img: ImageBitmapSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>
        }
      }
    ).FaceDetector
    if (!FaceDetectorCtor) return []

    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 5 })
    const faces = await detector.detect(source as ImageBitmapSource)
    const { width, height } = getSourceSize(source)
    return faces.map((f) => ({
      x: f.boundingBox.x / width,
      y: f.boundingBox.y / height,
      width: f.boundingBox.width / width,
      height: f.boundingBox.height / height,
      confidence: 1,
    }))
  } catch {
    return []
  }
}

async function detectBlazeFaceAll(
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceLandmark[]> {
  const model = await loadBlazeFace()
  if (!model) return []

  const { canvas } = toDetectionCanvas(source)
  const predictions = await model.estimateFaces(canvas, false)
  return predictions.map((face) => {
    const topLeft = Array.from(face.topLeft as ArrayLike<number>)
    const bottomRight = Array.from(face.bottomRight as ArrayLike<number>)
    const confidence = Array.isArray(face.probability)
      ? Number(face.probability[0])
      : face.probability
        ? Number((face.probability as Float32Array)[0])
        : 1
    return {
      x: topLeft[0] / canvas.width,
      y: topLeft[1] / canvas.height,
      width: (bottomRight[0] - topLeft[0]) / canvas.width,
      height: (bottomRight[1] - topLeft[1]) / canvas.height,
      confidence,
    }
  })
}

export function emptyFaceDetection(
  status: FaceDetection['status'] = 'not_started',
): FaceDetection {
  return {
    status,
    detected: false,
    confidence: 0,
    boundingBox: null,
    center: null,
    multipleFaces: false,
  }
}

/**
 * Run local face detection (bounding boxes only — never identifies people).
 */
export async function detectFace(source: ImageBitmap | HTMLCanvasElement | HTMLImageElement): Promise<FaceDetection> {
  try {
    let faces = await detectNativeAll(source)
    if (!faces.length) {
      faces = await detectBlazeFaceAll(source)
    }
    if (!faces.length) {
      return emptyFaceDetection('not_detected')
    }

    const { face, multiple } = pickBestFace(faces)
    const confidence = face.confidence ?? 1
    if (confidence < FACE_FRAMING.confidenceThreshold) {
      return {
        status: 'low_confidence',
        detected: false,
        confidence,
        boundingBox: face,
        center: calculateFaceCenter(face),
        multipleFaces: multiple,
      }
    }

    return {
      status: 'detected',
      detected: true,
      confidence,
      boundingBox: face,
      center: calculateFaceCenter(face),
      multipleFaces: multiple,
    }
  } catch (err) {
    console.warn('Face detection error:', err)
    return emptyFaceDetection('error')
  }
}

/** @deprecated Prefer detectFace — kept for compatibility. */
export async function detectFaceLandmark(
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceLandmark | null> {
  const result = await detectFace(source)
  return result.detected ? result.boundingBox : null
}

export function prefetchFaceModel() {
  void loadBlazeFace()
}

export function calculateFaceCenter(box: FaceLandmark): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

function targetForMode(mode: CenterMode): { x: number; y: number } {
  switch (mode) {
    case 'eyes':
      return { x: FACE_FRAMING.targetFaceX, y: FACE_FRAMING.targetEyesY }
    case 'nose':
      return { x: FACE_FRAMING.targetFaceX, y: FACE_FRAMING.targetNoseY }
    case 'shoulders':
      return { x: FACE_FRAMING.targetFaceX, y: FACE_FRAMING.targetShouldersY }
    case 'face':
    default:
      return { x: FACE_FRAMING.targetFaceX, y: FACE_FRAMING.targetFaceY }
  }
}

/**
 * Point in the source image (normalized) that should land on the crop target.
 * For "face" we aim a bit below the top of the head so headroom is preserved.
 */
function anchorPointInSource(box: FaceLandmark, mode: CenterMode): { x: number; y: number } {
  const center = calculateFaceCenter(box)
  switch (mode) {
    case 'eyes':
      return { x: center.x, y: box.y + box.height * 0.28 }
    case 'nose':
      return { x: center.x, y: box.y + box.height * 0.55 }
    case 'shoulders':
      return { x: center.x, y: box.y + box.height * 0.45 }
    case 'face':
    default: {
      // Slightly above geometric center — leaves headroom, shows shoulders
      return { x: center.x, y: box.y + box.height * 0.4 }
    }
  }
}

/**
 * Cover-scale factors used by the shared render pipeline.
 * drawW = srcW * coverScale, image center placed at (outputW * panX, outputH * panY).
 */
export function getCoverScale(
  srcW: number,
  srcH: number,
  outputW: number,
  outputH: number,
  zoom: number,
): number {
  return Math.max(outputW / srcW, outputH / srcH) * zoom
}

/**
 * Convert a desired source anchor → crop target into pan (settings.x / settings.y)
 * for the existing render pipeline.
 *
 * Render places the SOURCE CENTER at (outputW * panX, outputH * panY).
 * To put source point `anchor` at crop point `target`:
 *   pan = target - (anchor - 0.5) * (drawSize / outputSize)
 */
export function calculatePanForAnchor(options: {
  anchorX: number
  anchorY: number
  targetX: number
  targetY: number
  srcW: number
  srcH: number
  outputW: number
  outputH: number
  zoom: number
}): { x: number; y: number } {
  const { anchorX, anchorY, targetX, targetY, srcW, srcH, outputW, outputH, zoom } = options
  const coverScale = getCoverScale(srcW, srcH, outputW, outputH, zoom)
  const drawW = srcW * coverScale
  const drawH = srcH * coverScale

  let x = targetX - (anchorX - 0.5) * (drawW / outputW)
  let y = targetY - (anchorY - 0.5) * (drawH / outputH)

  // Soft clamp — keep some of the image in frame (matches LivePreview limits)
  x = Math.min(1.25, Math.max(-0.25, x))
  y = Math.min(1.25, Math.max(-0.25, y))
  return { x, y }
}

/**
 * Auto zoom so the detected face fills ~targetFaceHeightRatio of the crop height,
 * with headroom considered.
 */
export function calculateFaceZoom(
  box: FaceLandmark,
  srcW: number,
  srcH: number,
  outputW: number,
  outputH: number,
): number {
  // Face height in source pixels (normalized box → pixels)
  const faceH = box.height * srcH
  // Include headroom above face
  const framedFaceH = faceH * (1 + FACE_FRAMING.headroomFactor)
  if (framedFaceH <= 1) return 1

  // At zoom=1, cover scale maps source → output
  const baseCover = Math.max(outputW / srcW, outputH / srcH)
  // Face height in crop pixels at zoom=1
  const faceInCropAt1 = framedFaceH * baseCover
  const desired = FACE_FRAMING.targetFaceHeightRatio * outputH
  let zoom = desired / faceInCropAt1

  zoom = Math.min(FACE_FRAMING.maxZoom, Math.max(FACE_FRAMING.minZoom, zoom))
  return Number(zoom.toFixed(3))
}

export interface FaceCropResult {
  x: number
  y: number
  zoom: number
  centerMode: CenterMode
  applied: boolean
  reason?: string
}

/**
 * Shared face-crop calculation used by preview, apply-to-all, and export path.
 */
export function calculateFaceCropPosition(options: {
  detection: FaceDetection | null
  mode: CenterMode
  srcW: number
  srcH: number
  outputW: number
  outputH: number
  /** If provided, keep this zoom instead of auto-computing. */
  zoomOverride?: number
  adjustZoom?: boolean
}): FaceCropResult {
  const { detection, mode, srcW, srcH, outputW, outputH, zoomOverride, adjustZoom = true } =
    options

  if (mode === 'manual') {
    return { x: 0.5, y: 0.5, zoom: zoomOverride ?? 1, centerMode: 'manual', applied: false }
  }

  if (!detection?.detected || !detection.boundingBox) {
    return {
      x: 0.5,
      y: 0.5,
      zoom: zoomOverride ?? 1,
      centerMode: 'manual',
      applied: false,
      reason:
        detection?.status === 'low_confidence'
          ? 'low_confidence'
          : detection?.status === 'not_detected'
            ? 'not_detected'
            : 'unavailable',
    }
  }

  const box = detection.boundingBox
  const zoom =
    zoomOverride ??
    (adjustZoom ? calculateFaceZoom(box, srcW, srcH, outputW, outputH) : 1)

  const anchor = anchorPointInSource(box, mode)
  const target = targetForMode(mode)
  const pan = calculatePanForAnchor({
    anchorX: anchor.x,
    anchorY: anchor.y,
    targetX: target.x,
    targetY: target.y,
    srcW,
    srcH,
    outputW,
    outputH,
    zoom,
  })

  return {
    x: pan.x,
    y: pan.y,
    zoom,
    centerMode: mode,
    applied: true,
  }
}

/** Compatibility helper used by older call sites. */
export function centerFromFace(
  face: FaceLandmark | null,
  mode: CenterMode,
  dims?: { srcW: number; srcH: number; outputW: number; outputH: number; zoom?: number },
): { x: number; y: number; zoom?: number } | null {
  if (mode === 'manual' || !face) return null

  if (!dims) {
    // Legacy path — incorrect for render pipeline; prefer calculateFaceCropPosition
    const center = calculateFaceCenter(face)
    return { x: 1 - center.x, y: 1 - (face.y + face.height * 0.4) }
  }

  const detection: FaceDetection = {
    status: 'detected',
    detected: true,
    confidence: face.confidence ?? 1,
    boundingBox: face,
    center: calculateFaceCenter(face),
    multipleFaces: false,
  }
  const result = calculateFaceCropPosition({
    detection,
    mode,
    srcW: dims.srcW,
    srcH: dims.srcH,
    outputW: dims.outputW,
    outputH: dims.outputH,
    zoomOverride: dims.zoom,
    adjustZoom: dims.zoom == null,
  })
  if (!result.applied) return null
  return { x: result.x, y: result.y, zoom: result.zoom }
}

export function applyFaceCentering(options: {
  detection: FaceDetection | null
  mode: CenterMode
  srcW: number
  srcH: number
  outputW: number
  outputH: number
  adjustZoom?: boolean
  currentZoom?: number
}): FaceCropResult {
  return calculateFaceCropPosition({
    detection: options.detection,
    mode: options.mode,
    srcW: options.srcW,
    srcH: options.srcH,
    outputW: options.outputW,
    outputH: options.outputH,
    zoomOverride: options.adjustZoom === false ? options.currentZoom : undefined,
    adjustZoom: options.adjustZoom !== false,
  })
}
