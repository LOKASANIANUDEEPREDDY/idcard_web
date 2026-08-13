import { useCallback, useRef, useState } from 'react'
import { Upload, ImagePlus } from 'lucide-react'
import { useStudio } from '../store/StudioContext'
import { useAuth } from '../auth/AuthContext'
import { clsx } from '../lib/utils'

interface UploadZoneProps {
  onNeedSubscribe: () => void
}

export function UploadZone({ onNeedSubscribe }: UploadZoneProps) {
  const { uploadFiles, state, toast } = useStudio()
  const { canUploadCount, recordPhotosUsed, hasActiveSubscription, freeLimit, photosRemaining } =
    useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return
      const list = Array.from(files)
      const allowed = canUploadCount(list.length)
      if (allowed <= 0) {
        toast(
          'warning',
          `Free plan allows ${freeLimit} photos. Subscribe and enter a key to upload more.`,
        )
        onNeedSubscribe()
        return
      }

      const batch = allowed < list.length ? list.slice(0, allowed) : list
      if (allowed < list.length) {
        toast(
          'info',
          `Free plan: only ${allowed} more photo${allowed === 1 ? '' : 's'} allowed. Enter a key for unlimited.`,
        )
        onNeedSubscribe()
      }

      setBusy(true)
      try {
        const uploaded = await uploadFiles(batch)
        if (uploaded > 0) recordPhotosUsed(uploaded)
      } finally {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [
      canUploadCount,
      freeLimit,
      onNeedSubscribe,
      recordPhotosUsed,
      toast,
      uploadFiles,
    ],
  )

  return (
    <section id="upload-zone" className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
      {!hasActiveSubscription && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Free plan: {Math.max(0, Number.isFinite(photosRemaining) ? photosRemaining : 0)} of{' '}
          {freeLimit} photos remaining.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={onNeedSubscribe}
          >
            Enter subscription key
          </button>{' '}
          for unlimited uploads during your plan.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload images"
          className={clsx(
            'group relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-panel p-8 text-center transition',
            dragging
              ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-900/20'
              : 'border-line hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-900/10',
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handleFiles(e.dataTransfer.files)
          }}
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:scale-105 dark:bg-brand-900/40 dark:text-brand-300">
            {busy ? (
              <div className="size-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            ) : (
              <Upload className="size-7" />
            )}
          </div>
          <p className="font-display text-base font-semibold text-ink sm:text-lg">
            Drag & drop images or click to browse
          </p>
          <p className="mt-1 text-sm text-muted">Supports PNG, JPG, WEBP · Max 40 MB each</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            className="sr-only"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        <UploadedPanel />
      </div>

      {state.images.length === 0 && (
        <p className="mt-3 text-center text-sm text-muted">Upload images to get started</p>
      )}
    </section>
  )
}

function UploadedPanel() {
  const {
    state,
    setActive,
    toggleSelect,
    selectAll,
    deselectAll,
    removeSelectedImages,
    clearAllImages,
  } = useStudio()
  const [confirmClear, setConfirmClear] = useState(false)
  const count = state.images.length
  const selectedCount = state.images.filter((i) => i.selected).length

  if (count === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-line bg-panel p-8 text-center">
        <ImagePlus className="mb-3 size-10 text-muted/50" />
        <p className="font-display font-semibold text-ink">Uploaded Images (0)</p>
        <p className="mt-1 text-sm text-muted">Your uploads will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[200px] flex-col rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink">
          Uploaded Images ({count})
        </h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1 hover:bg-surface"
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1 hover:bg-surface"
            onClick={deselectAll}
          >
            Deselect
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1 hover:bg-surface disabled:opacity-40"
            disabled={selectedCount === 0}
            onClick={removeSelectedImages}
          >
            Remove Selected
          </button>
          <button
            type="button"
            className="rounded-md border border-danger/30 px-2 py-1 text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => setConfirmClear(true)}
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="no-scrollbar grid max-h-[280px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
        {state.images.map((img) => (
          <button
            key={img.id}
            type="button"
            className={clsx(
              'group relative aspect-square overflow-hidden rounded-lg border-2 bg-surface',
              state.activeImageId === img.id
                ? 'border-brand-600 ring-2 ring-brand-600/30'
                : 'border-transparent hover:border-brand-400',
            )}
            onClick={() => setActive(img.id)}
            title={img.originalName}
          >
            <img
              src={img.previewUrl}
              alt={img.originalName}
              className="size-full object-cover"
              draggable={false}
            />
            <span
              className="absolute left-1 top-1"
              onClick={(e) => {
                e.stopPropagation()
                toggleSelect(img.id)
              }}
            >
              <input
                type="checkbox"
                checked={img.selected}
                readOnly
                className="size-4 accent-brand-600"
                aria-label={`Select ${img.originalName}`}
              />
            </span>
            <StatusBadge
              status={img.status}
              hasOverride={img.hasOverride}
              faceStatus={img.faceDetection?.status}
            />
          </button>
        ))}
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-xl">
            <p className="font-semibold text-ink">Clear all images?</p>
            <p className="mt-1 text-sm text-muted">
              This removes all uploads and results from this session.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-2 text-sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  clearAllImages()
                  setConfirmClear(false)
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  hasOverride,
  faceStatus,
}: {
  status: string
  hasOverride: boolean
  faceStatus?: string
}) {
  const color =
    status === 'cropped'
      ? 'bg-success'
      : status === 'error'
        ? 'bg-danger'
        : status === 'processing'
          ? 'bg-warning animate-pulse-soft'
          : 'bg-brand-600'

  const faceTitle =
    faceStatus === 'detected'
      ? 'Face detected'
      : faceStatus === 'not_detected'
        ? 'Face not detected'
        : faceStatus === 'low_confidence'
          ? 'Low-confidence face'
          : faceStatus === 'detecting'
            ? 'Detecting face…'
            : undefined

  return (
    <>
      <span
        className={clsx('absolute right-1 top-1 size-2.5 rounded-full ring-2 ring-white', color)}
        title={status}
      />
      {faceStatus && faceStatus !== 'not_started' && (
        <span
          className={clsx(
            'absolute bottom-1 left-1 rounded px-1 text-[9px] font-semibold text-white',
            faceStatus === 'detected'
              ? 'bg-success/90'
              : faceStatus === 'detecting'
                ? 'bg-warning/90'
                : 'bg-slate-700/90',
          )}
          title={faceTitle}
        >
          {faceStatus === 'detected' ? '✓ face' : faceStatus === 'detecting' ? '…' : '! face'}
        </span>
      )}
      {hasOverride && (
        <span className="absolute bottom-1 right-1 rounded bg-slate-900/70 px-1 text-[9px] font-medium text-white">
          edit
        </span>
      )}
    </>
  )
}
