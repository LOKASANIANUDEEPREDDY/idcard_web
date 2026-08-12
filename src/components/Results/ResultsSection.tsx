import { useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useStudio } from '../../store/StudioContext'
import { downloadBlob, downloadResultsAsZip, renderExportBlob } from '../../lib/export'
import { buildExportFilename, clsx } from '../../lib/utils'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ResultAdjustModal } from './ResultAdjustModal'
import type { CroppedResult, ExportFormat, NamingMode } from '../../types'

export function ResultsSection() {
  const {
    state,
    selectedResults,
    setExport,
    toggleResultSelect,
    selectAllResults,
    deselectAllResults,
    removeSelectedResults,
    toast,
  } = useStudio()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const { results, exportSettings, processing, images } = state
  const count = results.length

  const resolveImage = (result: CroppedResult) =>
    images.find((img) => img.id === result.imageId)

  const downloadOne = async (id: string) => {
    const result = results.find((r) => r.id === id)
    if (!result) return
    const image = resolveImage(result)
    const used = new Set<string>()
    const name = buildExportFilename(
      result.filename,
      exportSettings.namingMode,
      exportSettings.postfix,
      exportSettings.format,
      used,
    )
    try {
      setDownloading(true)
      const blob = image
        ? await renderExportBlob(image, exportSettings)
        : result.blob
      await downloadBlob(blob, name)
    } catch {
      toast('error', 'Unable to export this image. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  const downloadMany = async (items: CroppedResult[]) => {
    if (!items.length) {
      toast('info', 'No images selected for download.')
      return
    }
    try {
      setDownloading(true)
      if (items.length === 1) {
        await downloadOne(items[0].id)
        return
      }

      const paired = items
        .map((r) => {
          const image = resolveImage(r)
          return image ? { image, originalName: r.filename } : null
        })
        .filter((x): x is { image: NonNullable<typeof x>['image']; originalName: string } => !!x)

      if (!paired.length) {
        toast('error', 'Unable to export images. Try cropping again.')
        return
      }

      const { ok, failed } = await downloadResultsAsZip(paired, {
        namingMode: exportSettings.namingMode,
        postfix: exportSettings.postfix,
        format: exportSettings.format,
        quality: exportSettings.quality,
        transparentBackground: exportSettings.transparentBackground,
        backgroundColor: exportSettings.backgroundColor,
      })
      if (failed) {
        toast(
          'warning',
          `ZIP downloaded. ${failed} file${failed === 1 ? '' : 's'} could not be added.`,
        )
      } else {
        toast('success', `ZIP downloaded successfully (${ok} files).`)
      }
    } catch (err) {
      console.warn(err)
      toast('error', 'Some files could not be added to the ZIP.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Cropping & Results</h2>
            <p className="text-sm text-muted">
              {count === 0
                ? 'Your cropped images will appear here.'
                : `Cropped Results (${count})`}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted">File Naming</p>
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {(['original', 'postfix'] as NamingMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-xs font-semibold capitalize',
                      exportSettings.namingMode === mode
                        ? 'bg-brand-700 text-white'
                        : 'text-ink hover:bg-surface',
                    )}
                    onClick={() => setExport({ namingMode: mode })}
                  >
                    {mode === 'original' ? 'Original' : 'Postfix'}
                  </button>
                ))}
              </div>
            </div>

            {exportSettings.namingMode === 'postfix' && (
              <label className="text-xs text-muted">
                Postfix
                <input
                  className="ml-1 w-28 rounded-lg border border-line px-2 py-1.5 text-sm text-ink"
                  value={exportSettings.postfix}
                  onChange={(e) => setExport({ postfix: e.target.value })}
                />
              </label>
            )}

            <label className="text-xs text-muted">
              Format
              <select
                className="ml-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink"
                value={exportSettings.format}
                onChange={(e) => setExport({ format: e.target.value as ExportFormat })}
              >
                <option value="png">PNG (Highest Quality)</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WEBP</option>
              </select>
            </label>

            {exportSettings.format !== 'png' && (
              <label className="text-xs text-muted">
                Quality
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="ml-1 w-16 rounded-lg border border-line px-2 py-1.5 text-sm"
                  value={exportSettings.quality}
                  onChange={(e) =>
                    setExport({
                      quality: Math.min(100, Math.max(1, parseInt(e.target.value) || 92)),
                    })
                  }
                />
              </label>
            )}

            {exportSettings.format === 'png' && (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={exportSettings.transparentBackground}
                  onChange={(e) => setExport({ transparentBackground: e.target.checked })}
                />
                Transparent background
              </label>
            )}

            {!exportSettings.transparentBackground && (
              <label className="text-xs text-muted">
                Background
                <input
                  type="color"
                  className="ml-1 h-8 w-10 cursor-pointer rounded border border-line"
                  value={exportSettings.backgroundColor}
                  onChange={(e) => setExport({ backgroundColor: e.target.value })}
                />
              </label>
            )}

            <button
              type="button"
              data-testid="download-all"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900"
              disabled={count === 0 || downloading}
              onClick={() => void downloadMany(results)}
            >
              <Download className="size-4" />
              {downloading ? 'Preparing…' : 'Download All'}
            </button>
          </div>
        </div>

        {processing.isProcessing && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/30">
            <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
              {processing.message}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{
                  width: `${(processing.current / Math.max(1, processing.total)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {count > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded-md border border-line px-2 py-1 hover:bg-surface"
              onClick={selectAllResults}
            >
              Select All
            </button>
            <button
              type="button"
              className="rounded-md border border-line px-2 py-1 hover:bg-surface"
              onClick={deselectAllResults}
            >
              Select None
            </button>
            <button
              type="button"
              className="rounded-md border border-line px-2 py-1 hover:bg-surface disabled:opacity-40"
              disabled={selectedResults.length === 0 || downloading}
              onClick={() => void downloadMany(selectedResults)}
            >
              Download Selected ({selectedResults.length})
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-danger/30 px-2 py-1 text-danger hover:bg-red-50 disabled:opacity-40"
              disabled={selectedResults.length === 0}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete Selected
            </button>
          </div>
        )}

        {count === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-surface text-muted">
              <Download className="size-6 opacity-40" />
            </div>
            <p className="font-medium text-ink">Your cropped images will appear here.</p>
            <p className="mt-1 text-sm text-muted">
              {state.images.length === 0
                ? 'Upload images to get started'
                : 'Select images to begin cropping.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {results.map((r) => (
              <div
                key={r.id}
                data-testid="result-card"
                className={clsx(
                  'group relative overflow-hidden rounded-xl border-2 bg-surface p-1.5',
                  r.selected ? 'border-brand-500' : 'border-transparent hover:border-brand-300',
                )}
              >
                <button
                  type="button"
                  className="absolute left-2 top-2 z-20"
                  onClick={() => toggleResultSelect(r.id)}
                  aria-label={`Select result ${r.filename}`}
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    readOnly
                    className="size-4 accent-brand-600"
                  />
                </button>

                <div className="relative aspect-square overflow-hidden rounded-lg">
                  <img
                    src={r.objectUrl}
                    alt={r.filename}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    data-testid="edit-result"
                    title={`Edit '${r.filename.replace(/\.[^.]+$/, '')}'`}
                    className={clsx(
                      'absolute right-1.5 top-1.5 z-20 inline-flex items-center gap-1 rounded-md',
                      'bg-brand-700 px-2 py-1 text-[11px] font-semibold text-white shadow',
                      'opacity-100 transition',
                      'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                    )}
                    onClick={() => setEditingResultId(r.id)}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    title={`Edit '${r.filename.replace(/\.[^.]+$/, '')}'`}
                    className={clsx(
                      'absolute inset-0 z-10 hidden items-center justify-center sm:flex',
                      'bg-slate-950/0 transition',
                      'opacity-0 group-hover:bg-slate-950/40 group-hover:opacity-100',
                      'focus-visible:bg-slate-950/40 focus-visible:opacity-100',
                    )}
                    onClick={() => setEditingResultId(r.id)}
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white shadow-lg ring-2 ring-white/80">
                      <Pencil className="size-3.5" />
                      Edit
                    </span>
                  </button>
                </div>

                <p className="mt-1 truncate px-0.5 text-[10px] text-muted" title={r.filename}>
                  {r.filename}
                </p>
                <p className="px-0.5 text-[10px] text-muted/80">
                  {r.width}×{r.height}
                </p>
                <button
                  type="button"
                  data-testid="download-one"
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-slate-800 py-1 text-[11px] font-medium text-white opacity-90 hover:opacity-100 disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900"
                  disabled={downloading}
                  onClick={() => void downloadOne(r.id)}
                >
                  <Download className="size-3" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete selected results?"
        description={`Remove ${selectedResults.length} cropped result${selectedResults.length === 1 ? '' : 's'}? Uploaded originals stay available.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          removeSelectedResults()
          setConfirmDelete(false)
        }}
      />

      {editingResultId && (
        <ResultAdjustModal
          resultId={editingResultId}
          onClose={() => setEditingResultId(null)}
          onNavigate={(id) => setEditingResultId(id)}
        />
      )}
    </section>
  )
}
