import { Header } from './components/Header'
import { UploadZone } from './components/UploadZone'
import { CropSettings } from './components/CropEditor/CropSettings'
import { LivePreview } from './components/CropEditor/LivePreview'
import { ResultsSection } from './components/Results/ResultsSection'
import { ToastStack } from './components/ui/ToastStack'
import { useStudio } from './store/StudioContext'
import { useEffect } from 'react'

function ThemeBoot() {
  const { state } = useStudio()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])
  return null
}

export default function App() {
  return (
    <div className="min-h-svh pb-10">
      <ThemeBoot />
      <Header />
      <UploadZone />

      <section className="mx-auto mt-6 grid max-w-[1400px] gap-4 px-4 lg:grid-cols-2 lg:items-stretch sm:px-6">
        <CropSettings />
        <LivePreview />
      </section>

      <ResultsSection />
      <ToastStack />

      <footer className="mx-auto mt-4 max-w-[1400px] px-4 text-center text-xs text-muted sm:px-6">
        Face Crop Studio · Privacy-first batch cropping · Images stay in your browser
      </footer>
    </div>
  )
}
