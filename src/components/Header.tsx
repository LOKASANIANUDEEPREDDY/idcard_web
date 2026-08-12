import { useEffect, useState } from 'react'
import {
  MessageSquare,
  PlayCircle,
  Moon,
  Sun,
  Crop,
} from 'lucide-react'
import { useStudio } from '../store/StudioContext'
import { clsx } from '../lib/utils'

export function Header() {
  const { state, setTheme } = useStudio()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm"
              aria-hidden
            >
              <Crop className="size-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <h1 className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
                  Face Crop Studio
                </h1>
              </div>
              <p className="truncate text-xs text-muted sm:text-sm">
                Batch crop images with custom shapes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquare className="size-4" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
            <a
              href="#demo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm font-medium text-ink hover:bg-surface"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <PlayCircle className="size-4" />
              <span className="hidden sm:inline">Demo</span>
            </a>
            <button
              type="button"
              className="rounded-lg border border-line p-2 text-ink hover:bg-surface"
              aria-label={state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(state.theme === 'dark' ? 'light' : 'dark')}
            >
              {state.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold">Send feedback</h2>
            <p className="mt-2 text-sm text-muted">
              Face Crop Studio processes images entirely in your browser. No photos leave your
              device. Share ideas or report issues with your team — this demo form stays local.
            </p>
            <textarea
              className="mt-4 h-28 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              placeholder="Your feedback…"
              aria-label="Feedback message"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-line px-4 py-2 text-sm"
                onClick={() => setFeedbackOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={clsx(
                  'rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800',
                )}
                onClick={() => setFeedbackOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
