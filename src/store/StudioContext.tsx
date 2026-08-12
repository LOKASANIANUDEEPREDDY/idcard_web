import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import {
  DEFAULT_CROP_SETTINGS,
  DEFAULT_EXPORT_SETTINGS,
  type CropSettings,
  type CroppedResult,
  type ExportSettings,
  type GlobalSettings,
  type ProcessingState,
  type StudioImage,
  type ToastMessage,
} from '../types'
import {
  detectFace,
  loadImageFile,
  revokeIfObjectUrl,
  settingsFromFaceDetection,
  emptyFaceDetection,
} from '../lib/imageLoader'
import { canvasToBlob, getOutputPixelSize, renderCroppedImage } from '../lib/renderPipeline'
import { createId } from '../lib/utils'
import { PRESETS } from '../lib/presets'

interface StudioState {
  images: StudioImage[]
  activeImageId: string | null
  globalSettings: GlobalSettings
  exportSettings: ExportSettings
  results: CroppedResult[]
  processing: ProcessingState
  toasts: ToastMessage[]
  theme: 'light' | 'dark'
  historyVersion: number
  detectionProgress: ProcessingState
  showDetectionOverlay: boolean
}

type Action =
  | { type: 'ADD_IMAGES'; images: StudioImage[] }
  | { type: 'REMOVE_IMAGES'; ids: string[] }
  | { type: 'CLEAR_IMAGES' }
  | { type: 'SET_ACTIVE'; id: string | null }
  | { type: 'TOGGLE_SELECT'; id: string }
  | { type: 'SELECT_ALL' }
  | { type: 'DESELECT_ALL' }
  | {
      type: 'UPDATE_GLOBAL'
      patch: Partial<CropSettings>
      pushHistory?: boolean
      syncToSelected?: boolean
      syncToAll?: boolean
    }
  | { type: 'UPDATE_IMAGE_SETTINGS'; id: string; patch: Partial<CropSettings>; markOverride?: boolean }
  | { type: 'APPLY_IMAGE_SETTINGS'; updates: Array<{ id: string; cropSettings: CropSettings; hasOverride?: boolean }> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'SET_EXPORT'; patch: Partial<ExportSettings> }
  | { type: 'SET_PROCESSING'; patch: Partial<ProcessingState> }
  | { type: 'ADD_RESULTS'; results: CroppedResult[] }
  | { type: 'TOGGLE_RESULT_SELECT'; id: string }
  | { type: 'SELECT_ALL_RESULTS' }
  | { type: 'DESELECT_ALL_RESULTS' }
  | { type: 'REMOVE_RESULTS'; ids: string[] }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'SET_IMAGE_STATUS'; id: string; status: StudioImage['status']; error?: string | null }
  | { type: 'SET_IMAGE_FACE'; id: string; faceDetection: import('../types').FaceDetection }
  | { type: 'SET_DETECTION_PROGRESS'; patch: Partial<ProcessingState> }
  | { type: 'SET_SHOW_DETECTION'; value: boolean }
  | { type: 'TOAST'; toast: Omit<ToastMessage, 'id'> }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const initialProcessing: ProcessingState = {
  isProcessing: false,
  current: 0,
  total: 0,
  failed: 0,
  message: '',
}

function initialState(): StudioState {
  const theme =
    typeof window !== 'undefined' &&
    (localStorage.getItem('fcs-theme') === 'dark' ||
      (!localStorage.getItem('fcs-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches))
      ? 'dark'
      : 'light'
  return {
    images: [],
    activeImageId: null,
    globalSettings: { ...DEFAULT_CROP_SETTINGS },
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
    results: [],
    processing: initialProcessing,
    toasts: [],
    theme,
    historyVersion: 0,
    detectionProgress: initialProcessing,
    showDetectionOverlay: false,
  }
}

/** History stacks live outside reducer to avoid serializing bitmaps */
const historyRef = {
  past: [] as CropSettings[],
  future: [] as CropSettings[],
}

function pushHistory(settings: CropSettings) {
  historyRef.past.push({ ...settings, customShape: settings.customShape })
  if (historyRef.past.length > 40) historyRef.past.shift()
  historyRef.future = []
}

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case 'ADD_IMAGES': {
      const images = [...state.images, ...action.images]
      const activeImageId = state.activeImageId ?? action.images[0]?.id ?? null
      return { ...state, images, activeImageId }
    }
    case 'REMOVE_IMAGES': {
      const idSet = new Set(action.ids)
      const removed = state.images.filter((i) => idSet.has(i.id))
      removed.forEach((img) => {
        revokeIfObjectUrl(img.previewUrl)
        img.sourceBitmap?.close()
        img.previewBitmap?.close()
        if (img.result) revokeIfObjectUrl(img.result.objectUrl)
      })
      const images = state.images.filter((i) => !idSet.has(i.id))
      const activeImageId =
        state.activeImageId && idSet.has(state.activeImageId)
          ? images[0]?.id ?? null
          : state.activeImageId
      const results = state.results.filter((r) => !idSet.has(r.imageId))
      return { ...state, images, activeImageId, results }
    }
    case 'CLEAR_IMAGES': {
      state.images.forEach((img) => {
        revokeIfObjectUrl(img.previewUrl)
        img.sourceBitmap?.close()
        img.previewBitmap?.close()
      })
      state.results.forEach((r) => revokeIfObjectUrl(r.objectUrl))
      return {
        ...state,
        images: [],
        activeImageId: null,
        results: [],
      }
    }
    case 'SET_ACTIVE':
      return { ...state, activeImageId: action.id }
    case 'TOGGLE_SELECT':
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id ? { ...img, selected: !img.selected } : img,
        ),
      }
    case 'SELECT_ALL':
      return {
        ...state,
        images: state.images.map((img) => ({ ...img, selected: true })),
      }
    case 'DESELECT_ALL':
      return {
        ...state,
        images: state.images.map((img) => ({ ...img, selected: false })),
      }
    case 'UPDATE_GLOBAL': {
      if (action.pushHistory !== false) pushHistory(state.globalSettings)
      let next = { ...state.globalSettings, ...action.patch }
      let fieldPatch: Partial<CropSettings> = { ...action.patch }
      if (action.patch.preset && action.patch.preset !== 'none') {
        const preset = PRESETS[action.patch.preset]
        if (preset) {
          next = { ...next, ...preset.values, preset: action.patch.preset }
          fieldPatch = { ...fieldPatch, ...preset.values, preset: action.patch.preset }
        }
      }
      // Only wipe adjustments when Remove preset is clicked alone — not when a slider
      // also sends preset:'none' to clear the preset label.
      const onlyClearingPreset =
        action.patch.preset === 'none' &&
        !('contrast' in action.patch) &&
        !('brightness' in action.patch) &&
        !('saturation' in action.patch) &&
        !('vignette' in action.patch)
      if (onlyClearingPreset) {
        const cleared = {
          contrast: 1,
          brightness: 1,
          saturation: 1,
          vignette: 0,
          preset: 'none' as const,
        }
        next = { ...next, ...cleared }
        fieldPatch = { ...fieldPatch, ...cleared }
      }
      const activeId = state.activeImageId
      const syncIds = action.syncToAll
        ? new Set(state.images.map((i) => i.id))
        : action.syncToSelected
          ? new Set(state.images.filter((i) => i.selected).map((i) => i.id))
          : null
      return {
        ...state,
        globalSettings: next,
        historyVersion: state.historyVersion + 1,
        images: state.images.map((img) => {
          const shouldUpdate =
            (activeId && img.id === activeId) || (syncIds && syncIds.has(img.id))
          if (!shouldUpdate) return img
          return {
            ...img,
            cropSettings: { ...img.cropSettings, ...fieldPatch },
            hasOverride: syncIds?.has(img.id) ? false : img.hasOverride,
          }
        }),
      }
    }
    case 'UPDATE_IMAGE_SETTINGS': {
      return {
        ...state,
        images: state.images.map((img) => {
          if (img.id !== action.id) return img
          let cropSettings = { ...img.cropSettings, ...action.patch }
          if (action.patch.preset && action.patch.preset !== 'none') {
            const preset = PRESETS[action.patch.preset]
            if (preset) cropSettings = { ...cropSettings, ...preset.values }
          }
          const onlyClearingPreset =
            action.patch.preset === 'none' &&
            !('contrast' in action.patch) &&
            !('brightness' in action.patch) &&
            !('saturation' in action.patch) &&
            !('vignette' in action.patch)
          if (onlyClearingPreset) {
            cropSettings = {
              ...cropSettings,
              contrast: 1,
              brightness: 1,
              saturation: 1,
              vignette: 0,
              preset: 'none',
            }
          }
          return {
            ...img,
            cropSettings,
            hasOverride: action.markOverride ?? true,
          }
        }),
        globalSettings:
          state.activeImageId === action.id
            ? { ...state.globalSettings, ...action.patch }
            : state.globalSettings,
      }
    }
    case 'APPLY_IMAGE_SETTINGS': {
      const map = new Map(action.updates.map((u) => [u.id, u]))
      return {
        ...state,
        images: state.images.map((img) => {
          const update = map.get(img.id)
          if (!update) return img
          return {
            ...img,
            cropSettings: update.cropSettings,
            hasOverride: update.hasOverride ?? false,
          }
        }),
      }
    }
    case 'RESET_SETTINGS': {
      pushHistory(state.globalSettings)
      const reset = { ...DEFAULT_CROP_SETTINGS }
      return {
        ...state,
        globalSettings: reset,
        historyVersion: state.historyVersion + 1,
        images: state.images.map((img) => {
          const framed = settingsFromFaceDetection(
            reset,
            img.faceDetection ?? emptyFaceDetection(),
            img.width,
            img.height,
            true,
          )
          return {
            ...img,
            cropSettings: framed,
            hasOverride: false,
          }
        }),
      }
    }
    case 'SET_EXPORT':
      return { ...state, exportSettings: { ...state.exportSettings, ...action.patch } }
    case 'SET_PROCESSING':
      return { ...state, processing: { ...state.processing, ...action.patch } }
    case 'ADD_RESULTS': {
      const newIds = new Set(action.results.map((r) => r.imageId))
      // Replace prior results for same images
      const kept = state.results.filter((r) => {
        if (newIds.has(r.imageId)) {
          revokeIfObjectUrl(r.objectUrl)
          return false
        }
        return true
      })
      const results = [...kept, ...action.results]
      return {
        ...state,
        results,
        images: state.images.map((img) => {
          const result = action.results.find((r) => r.imageId === img.id)
          if (!result) return img
          return { ...img, status: 'cropped' as const, result, error: null }
        }),
      }
    }
    case 'TOGGLE_RESULT_SELECT':
      return {
        ...state,
        results: state.results.map((r) =>
          r.id === action.id ? { ...r, selected: !r.selected } : r,
        ),
      }
    case 'SELECT_ALL_RESULTS':
      return { ...state, results: state.results.map((r) => ({ ...r, selected: true })) }
    case 'DESELECT_ALL_RESULTS':
      return { ...state, results: state.results.map((r) => ({ ...r, selected: false })) }
    case 'REMOVE_RESULTS': {
      const idSet = new Set(action.ids)
      state.results.filter((r) => idSet.has(r.id)).forEach((r) => revokeIfObjectUrl(r.objectUrl))
      return {
        ...state,
        results: state.results.filter((r) => !idSet.has(r.id)),
        images: state.images.map((img) => {
          if (img.result && idSet.has(img.result.id)) {
            return { ...img, result: null, status: 'uploaded' as const }
          }
          return img
        }),
      }
    }
    case 'CLEAR_RESULTS': {
      state.results.forEach((r) => revokeIfObjectUrl(r.objectUrl))
      return {
        ...state,
        results: [],
        images: state.images.map((img) => ({
          ...img,
          result: null,
          status: img.status === 'cropped' ? 'uploaded' : img.status,
        })),
      }
    }
    case 'SET_IMAGE_STATUS':
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id
            ? { ...img, status: action.status, error: action.error ?? null }
            : img,
        ),
      }
    case 'SET_IMAGE_FACE': {
      const faceDetection = action.faceDetection
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.id
            ? {
                ...img,
                faceDetection,
                face: faceDetection.boundingBox,
              }
            : img,
        ),
      }
    }
    case 'SET_DETECTION_PROGRESS':
      return {
        ...state,
        detectionProgress: { ...state.detectionProgress, ...action.patch },
      }
    case 'SET_SHOW_DETECTION':
      return { ...state, showDetectionOverlay: action.value }
    case 'TOAST':
      return {
        ...state,
        toasts: [
          ...state.toasts.slice(-4),
          { ...action.toast, id: createId('toast') },
        ],
      }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'UNDO': {
      const prev = historyRef.past.pop()
      if (!prev) return state
      historyRef.future.push(state.globalSettings)
      return {
        ...state,
        globalSettings: prev,
        historyVersion: state.historyVersion + 1,
      }
    }
    case 'REDO': {
      const next = historyRef.future.pop()
      if (!next) return state
      historyRef.past.push(state.globalSettings)
      return {
        ...state,
        globalSettings: next,
        historyVersion: state.historyVersion + 1,
      }
    }
    default:
      return state
  }
}

interface StudioContextValue {
  state: StudioState
  activeImage: StudioImage | null
  selectedImages: StudioImage[]
  selectedResults: CroppedResult[]
  canUndo: boolean
  canRedo: boolean
  uploadFiles: (files: FileList | File[]) => Promise<void>
  removeSelectedImages: () => void
  clearAllImages: () => void
  setActive: (id: string | null) => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  updateSettings: (
    patch: Partial<CropSettings>,
    opts?: { imageOnly?: boolean; syncToSelected?: boolean; syncToAll?: boolean },
  ) => void
  ensureFaceCentered: (mode?: import('../types').CenterMode) => Promise<boolean>
  recenterFace: () => Promise<boolean>
  applyToSelected: () => Promise<void>
  resetSettings: () => void
  setExport: (patch: Partial<ExportSettings>) => void
  setShowDetectionOverlay: (value: boolean) => void
  cropSelected: () => Promise<void>
  toggleResultSelect: (id: string) => void
  selectAllResults: () => void
  deselectAllResults: () => void
  removeSelectedResults: () => void
  toast: (type: ToastMessage['type'], message: string) => void
  dismissToast: (id: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  undo: () => void
  redo: () => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const uploading = useRef(false)

  const activeImage = useMemo(
    () => state.images.find((i) => i.id === state.activeImageId) ?? null,
    [state.images, state.activeImageId],
  )
  const selectedImages = useMemo(
    () => state.images.filter((i) => i.selected),
    [state.images],
  )
  const selectedResults = useMemo(
    () => state.results.filter((r) => r.selected),
    [state.results],
  )

  const toast = useCallback((type: ToastMessage['type'], message: string) => {
    dispatch({ type: 'TOAST', toast: { type, message } })
  }, [])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (uploading.current) return
      uploading.current = true
      const list = Array.from(files)
      let ok = 0
      let skipped = 0
      let facesFound = 0
      let multiFace = 0
      const loaded: StudioImage[] = []

      dispatch({
        type: 'SET_DETECTION_PROGRESS',
        patch: {
          isProcessing: true,
          current: 0,
          total: list.length,
          failed: 0,
          message: `Detecting faces… 0 / ${list.length}`,
        },
      })

      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        try {
          const data = await loadImageFile(file)
          let settings: CropSettings = { ...state.globalSettings }

          if (settings.centerMode !== 'manual' && data.faceDetection.detected) {
            settings = settingsFromFaceDetection(
              settings,
              data.faceDetection,
              data.width,
              data.height,
              true,
            )
            facesFound += 1
            if (data.faceDetection.multipleFaces) multiFace += 1
          } else if (settings.centerMode !== 'manual' && !data.faceDetection.detected) {
            settings = {
              ...settings,
              x: 0.5,
              y: 0.5,
            }
          }

          loaded.push({
            id: createId('img'),
            file,
            originalName: file.name,
            previewUrl: data.previewUrl,
            sourceBitmap: data.bitmap,
            previewBitmap: data.previewBitmap,
            width: data.width,
            height: data.height,
            selected: true,
            status: 'uploaded',
            cropSettings: settings,
            hasOverride: false,
            face: data.face,
            faceDetection: data.faceDetection,
            result: null,
            error: null,
          })
          ok += 1
        } catch (err) {
          skipped += 1
          console.warn('Upload skipped:', file.name, err)
        }

        dispatch({
          type: 'SET_DETECTION_PROGRESS',
          patch: {
            current: i + 1,
            message: `Detecting faces… ${i + 1} / ${list.length}`,
          },
        })
        // Yield so UI can update
        await new Promise((r) => setTimeout(r, 0))
      }

      if (loaded.length) {
        dispatch({ type: 'ADD_IMAGES', images: loaded })
      }

      dispatch({
        type: 'SET_DETECTION_PROGRESS',
        patch: { isProcessing: false, message: '' },
      })

      if (ok && skipped) {
        toast(
          'warning',
          `${ok} image${ok === 1 ? '' : 's'} uploaded successfully. ${skipped} unsupported file${skipped === 1 ? ' was' : 's were'} skipped.`,
        )
      } else if (ok) {
        toast('success', `${ok} image${ok === 1 ? '' : 's'} uploaded.`)
      } else if (skipped) {
        toast('error', 'Unsupported image format. Please upload JPG, JPEG, PNG, or WEBP.')
      }

      if (facesFound) {
        toast(
          'info',
          `Face detected on ${facesFound} of ${ok} image${ok === 1 ? '' : 's'}.`,
        )
      }
      if (multiFace) {
        toast(
          'info',
          `Multiple faces detected on ${multiFace} image${multiFace === 1 ? '' : 's'}. Using the largest face.`,
        )
      }

      uploading.current = false
    },
    [state.globalSettings, toast],
  )

  const cropSelected = useCallback(async () => {
    const targets = state.images.filter((i) => i.selected)
    if (!targets.length) {
      toast('info', 'Select images to begin cropping.')
      return
    }

    dispatch({
      type: 'SET_PROCESSING',
      patch: {
        isProcessing: true,
        current: 0,
        total: targets.length,
        failed: 0,
        message: `Cropping 0 / ${targets.length}`,
      },
    })

    const results: CroppedResult[] = []
    let failed = 0
    const { format, quality } = state.exportSettings

    for (let i = 0; i < targets.length; i++) {
      const img = targets[i]
      dispatch({
        type: 'SET_IMAGE_STATUS',
        id: img.id,
        status: 'processing',
      })
      dispatch({
        type: 'SET_PROCESSING',
        patch: {
          current: i + 1,
          failed,
          message: `Cropping ${i + 1} / ${targets.length}`,
        },
      })

      try {
        const source = img.sourceBitmap ?? img.previewBitmap
        if (!source) throw new Error('Missing image data')

        const settings = {
          ...img.cropSettings,
          transparentBackground: state.exportSettings.transparentBackground,
          backgroundColor: state.exportSettings.backgroundColor,
        }
        const { width, height } = getOutputPixelSize(settings)
        const canvas = renderCroppedImage(source, settings, {
          outputWidth: width,
          outputHeight: height,
          showOverlay: false,
          transparentBackground:
            format === 'png' ? state.exportSettings.transparentBackground : false,
          backgroundColor: state.exportSettings.backgroundColor,
        })
        const blob = await canvasToBlob(
          canvas,
          format === 'png' && !state.exportSettings.transparentBackground
            ? 'png'
            : format,
          quality,
        )
        const objectUrl = URL.createObjectURL(blob)
        results.push({
          id: createId('res'),
          imageId: img.id,
          blob,
          objectUrl,
          width,
          height,
          filename: img.originalName,
          selected: true,
          createdAt: Date.now(),
        })
        // Yield to UI between images
        await new Promise((r) => setTimeout(r, 0))
      } catch (err) {
        failed += 1
        console.warn('Crop failed:', img.originalName, err)
        dispatch({
          type: 'SET_IMAGE_STATUS',
          id: img.id,
          status: 'error',
          error: 'This image could not be processed.',
        })
      }
    }

    if (results.length) {
      dispatch({ type: 'ADD_RESULTS', results })
    }

    dispatch({
      type: 'SET_PROCESSING',
      patch: {
        isProcessing: false,
        current: targets.length,
        total: targets.length,
        failed,
        message: '',
      },
    })

    if (failed && results.length) {
      toast('warning', `${results.length} images cropped successfully. ${failed} images failed.`)
    } else if (results.length) {
      toast('success', `${results.length} images cropped successfully.`)
    } else {
      toast('error', 'Unable to crop images. Try again.')
    }
  }, [state.images, state.exportSettings, toast])

  const value: StudioContextValue = {
    state,
    activeImage,
    selectedImages,
    selectedResults,
    canUndo: historyRef.past.length > 0,
    // historyVersion forces re-render after undo/redo stack changes
    canRedo: state.historyVersion >= 0 && historyRef.future.length > 0,
    uploadFiles,
    removeSelectedImages: () => {
      const ids = state.images.filter((i) => i.selected).map((i) => i.id)
      if (ids.length) dispatch({ type: 'REMOVE_IMAGES', ids })
    },
    clearAllImages: () => dispatch({ type: 'CLEAR_IMAGES' }),
    setActive: (id) => dispatch({ type: 'SET_ACTIVE', id }),
    toggleSelect: (id) => dispatch({ type: 'TOGGLE_SELECT', id }),
    selectAll: () => dispatch({ type: 'SELECT_ALL' }),
    deselectAll: () => dispatch({ type: 'DESELECT_ALL' }),
    updateSettings: (patch, opts) => {
      if (opts?.imageOnly && state.activeImageId) {
        dispatch({
          type: 'UPDATE_IMAGE_SETTINGS',
          id: state.activeImageId,
          patch,
          markOverride: true,
        })
      } else {
        dispatch({
          type: 'UPDATE_GLOBAL',
          patch,
          syncToSelected: opts?.syncToSelected === true,
          syncToAll: opts?.syncToAll === true,
        })
      }
    },
    ensureFaceCentered: async (mode) => {
      const img = state.images.find((i) => i.id === state.activeImageId)
      if (!img) return false
      const centerMode = mode ?? img.cropSettings.centerMode
      if (centerMode === 'manual') {
        dispatch({
          type: 'UPDATE_IMAGE_SETTINGS',
          id: img.id,
          patch: { centerMode: 'manual' },
          markOverride: true,
        })
        return true
      }

      let detection = img.faceDetection
      if (!detection?.detected) {
        const source = img.previewBitmap ?? img.sourceBitmap
        if (source) {
          detection = await detectFace(source)
          if (!detection.detected && img.sourceBitmap && img.sourceBitmap !== source) {
            detection = await detectFace(img.sourceBitmap)
          }
        } else {
          detection = emptyFaceDetection('error')
        }
        dispatch({ type: 'SET_IMAGE_FACE', id: img.id, faceDetection: detection })
        if (detection.multipleFaces) {
          toast('info', 'Multiple faces detected. Using the largest face.')
        }
      }

      const framed = settingsFromFaceDetection(
        { ...img.cropSettings, centerMode },
        detection,
        img.width,
        img.height,
        true,
      )

      if (!detection.detected) {
        dispatch({
          type: 'UPDATE_IMAGE_SETTINGS',
          id: img.id,
          patch: { centerMode: 'manual', x: 0.5, y: 0.5 },
          markOverride: false,
        })
        return false
      }

      dispatch({
        type: 'UPDATE_IMAGE_SETTINGS',
        id: img.id,
        patch: {
          centerMode: framed.centerMode,
          x: framed.x,
          y: framed.y,
          zoom: framed.zoom,
        },
        markOverride: false,
      })
      return true
    },
    recenterFace: async () => {
      const img = state.images.find((i) => i.id === state.activeImageId)
      if (!img) return false

      const source = img.previewBitmap ?? img.sourceBitmap
      if (!source) {
        toast('warning', 'Face could not be detected.')
        return false
      }

      dispatch({
        type: 'SET_IMAGE_FACE',
        id: img.id,
        faceDetection: { ...emptyFaceDetection('detecting'), status: 'detecting' },
      })

      let detection = await detectFace(source)
      if (!detection.detected && img.sourceBitmap && img.sourceBitmap !== source) {
        detection = await detectFace(img.sourceBitmap)
      }
      dispatch({ type: 'SET_IMAGE_FACE', id: img.id, faceDetection: detection })

      if (!detection.detected) {
        toast('warning', 'Face could not be detected.')
        return false
      }
      if (detection.multipleFaces) {
        toast('info', 'Multiple faces detected. Using the largest face.')
      }

      const mode =
        img.cropSettings.centerMode === 'manual' ? 'face' : img.cropSettings.centerMode
      const framed = settingsFromFaceDetection(
        { ...img.cropSettings, centerMode: mode },
        detection,
        img.width,
        img.height,
        true,
      )
      dispatch({
        type: 'UPDATE_IMAGE_SETTINGS',
        id: img.id,
        patch: {
          centerMode: framed.centerMode,
          x: framed.x,
          y: framed.y,
          zoom: framed.zoom,
        },
        markOverride: false,
      })
      toast('success', 'Face recentered.')
      return true
    },
    applyToSelected: async () => {
      const selected = state.images.filter((i) => i.selected)
      if (!selected.length) {
        toast('info', 'Select images to apply settings.')
        return
      }

      const template =
        state.images.find((i) => i.id === state.activeImageId)?.cropSettings ??
        state.globalSettings

      dispatch({
        type: 'SET_DETECTION_PROGRESS',
        patch: {
          isProcessing: true,
          current: 0,
          total: selected.length,
          failed: 0,
          message: `Applying face centering… 0 / ${selected.length}`,
        },
      })

      const updates: Array<{ id: string; cropSettings: CropSettings; hasOverride: boolean }> =
        []
      let failed = 0
      let multi = 0

      for (let i = 0; i < selected.length; i++) {
        const img = selected[i]
        // Shared visual settings from template — NOT the template's x/y/zoom when face mode
        const shared: CropSettings = {
          ...template,
          x: img.cropSettings.x,
          y: img.cropSettings.y,
          zoom: img.cropSettings.zoom,
          rotation: img.cropSettings.rotation,
        }

        if (template.centerMode === 'manual') {
          updates.push({
            id: img.id,
            cropSettings: {
              ...template,
            },
            hasOverride: false,
          })
        } else {
          let detection = img.faceDetection
          if (!detection?.detected) {
            const source = img.previewBitmap ?? img.sourceBitmap
            if (source) {
              detection = await detectFace(source)
              dispatch({ type: 'SET_IMAGE_FACE', id: img.id, faceDetection: detection })
              if (detection.multipleFaces) multi += 1
            }
          } else if (detection.multipleFaces) {
            multi += 1
          }

          if (detection?.detected) {
            const framed = settingsFromFaceDetection(
              { ...shared, centerMode: template.centerMode },
              detection,
              img.width,
              img.height,
              true,
            )
            updates.push({ id: img.id, cropSettings: framed, hasOverride: false })
          } else {
            failed += 1
            updates.push({
              id: img.id,
              cropSettings: {
                ...shared,
                centerMode: template.centerMode,
                x: 0.5,
                y: 0.5,
              },
              hasOverride: false,
            })
          }
        }

        dispatch({
          type: 'SET_DETECTION_PROGRESS',
          patch: {
            current: i + 1,
            failed,
            message: `Applying face centering… ${i + 1} / ${selected.length}`,
          },
        })
        await new Promise((r) => setTimeout(r, 0))
      }

      dispatch({ type: 'APPLY_IMAGE_SETTINGS', updates })
      dispatch({
        type: 'UPDATE_GLOBAL',
        patch: {
          shape: template.shape,
          width: template.width,
          height: template.height,
          unit: template.unit,
          aspectLocked: template.aspectLocked,
          border: template.border,
          contrast: template.contrast,
          brightness: template.brightness,
          saturation: template.saturation,
          vignette: template.vignette,
          preset: template.preset,
          centerMode: template.centerMode,
          customShape: template.customShape,
          backgroundColor: template.backgroundColor,
          transparentBackground: template.transparentBackground,
        },
        pushHistory: true,
      })
      dispatch({
        type: 'SET_DETECTION_PROGRESS',
        patch: { isProcessing: false, message: '' },
      })

      toast(
        'success',
        `Settings applied to ${selected.length} image${selected.length === 1 ? '' : 's'}.`,
      )
      if (failed) {
        toast(
          'warning',
          `Face not detected on ${failed} image${failed === 1 ? '' : 's'} — using center fallback.`,
        )
      }
      if (multi) {
        toast(
          'info',
          `Multiple faces detected on ${multi} image${multi === 1 ? '' : 's'}. Using the largest face.`,
        )
      }
    },
    resetSettings: () => {
      dispatch({ type: 'RESET_SETTINGS' })
      toast('info', 'Settings reset.')
    },
    setExport: (patch) => dispatch({ type: 'SET_EXPORT', patch }),
    setShowDetectionOverlay: (value) => dispatch({ type: 'SET_SHOW_DETECTION', value }),
    cropSelected,
    toggleResultSelect: (id) => dispatch({ type: 'TOGGLE_RESULT_SELECT', id }),
    selectAllResults: () => dispatch({ type: 'SELECT_ALL_RESULTS' }),
    deselectAllResults: () => dispatch({ type: 'DESELECT_ALL_RESULTS' }),
    removeSelectedResults: () => {
      const ids = selectedResults.map((r) => r.id)
      dispatch({ type: 'REMOVE_RESULTS', ids })
    },
    toast,
    dismissToast: (id) => dispatch({ type: 'DISMISS_TOAST', id }),
    setTheme: (theme) => {
      localStorage.setItem('fcs-theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
      dispatch({ type: 'SET_THEME', theme })
    },
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used within StudioProvider')
  return ctx
}
