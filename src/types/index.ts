export type CropShape =
  | 'circle'
  | 'square'
  | 'rounded'
  | 'heart'
  | 'star'
  | 'hexagon'
  | 'curvedHex'
  | 'custom'

export type CenterMode = 'face' | 'shoulders' | 'eyes' | 'nose' | 'manual'

export type DimensionUnit = 'px' | 'mm' | 'cm'

export type ImageStatus = 'uploaded' | 'processing' | 'cropped' | 'error'

export type FaceDetectionStatus =
  | 'not_started'
  | 'detecting'
  | 'detected'
  | 'not_detected'
  | 'low_confidence'
  | 'error'

export type ExportFormat = 'png' | 'jpeg' | 'webp'

export type NamingMode = 'original' | 'postfix'

export type PresetId =
  | 'none'
  | 'vivid'
  | 'bw'
  | 'vintage'
  | 'natural'
  | 'soft'
  | 'airy'
  | 'moody'
  | 'cinema'

export interface CustomShapeConfig {
  type: 'svg' | 'polygon'
  path?: string
  points?: string
  name: string
}

export interface CropSettings {
  shape: CropShape
  centerMode: CenterMode
  x: number
  y: number
  zoom: number
  rotation: number
  width: number
  height: number
  unit: DimensionUnit
  aspectLocked: boolean
  border: number
  contrast: number
  brightness: number
  saturation: number
  vignette: number
  preset: PresetId
  customShape: CustomShapeConfig | null
  backgroundColor: string
  transparentBackground: boolean
}

export interface FaceLandmark {
  x: number
  y: number
  width: number
  height: number
  confidence?: number
}

export interface FaceDetection {
  status: FaceDetectionStatus
  detected: boolean
  confidence: number
  boundingBox: FaceLandmark | null
  center: { x: number; y: number } | null
  multipleFaces: boolean
}

export interface StudioImage {
  id: string
  file: File
  originalName: string
  previewUrl: string
  sourceBitmap: ImageBitmap | null
  previewBitmap: ImageBitmap | null
  width: number
  height: number
  selected: boolean
  status: ImageStatus
  cropSettings: CropSettings
  hasOverride: boolean
  /** @deprecated use faceDetection.boundingBox */
  face: FaceLandmark | null
  faceDetection: FaceDetection
  result: CroppedResult | null
  error: string | null
}

export interface CroppedResult {
  id: string
  imageId: string
  blob: Blob
  objectUrl: string
  width: number
  height: number
  filename: string
  selected: boolean
  createdAt: number
}

export interface ExportSettings {
  format: ExportFormat
  quality: number
  namingMode: NamingMode
  postfix: string
  transparentBackground: boolean
  backgroundColor: string
}

export interface ProcessingState {
  isProcessing: boolean
  current: number
  total: number
  failed: number
  message: string
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export interface GlobalSettings extends CropSettings {}

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  shape: 'circle',
  centerMode: 'face',
  x: 0.5,
  y: 0.5,
  zoom: 1,
  rotation: 0,
  width: 512,
  height: 512,
  unit: 'px',
  aspectLocked: true,
  border: 0,
  contrast: 1,
  brightness: 1,
  saturation: 1,
  vignette: 0,
  preset: 'none',
  customShape: null,
  backgroundColor: '#ffffff',
  transparentBackground: true,
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'png',
  quality: 92,
  namingMode: 'original',
  postfix: '_cropped',
  transparentBackground: true,
  backgroundColor: '#ffffff',
}

export const MAX_FILE_SIZE_MB = 40
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
export const PREVIEW_MAX_EDGE = 1200
export const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
