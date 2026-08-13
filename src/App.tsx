import { useEffect, useState } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Header } from './components/Header'
import { UploadZone } from './components/UploadZone'
import { CropSettings } from './components/CropEditor/CropSettings'
import { LivePreview } from './components/CropEditor/LivePreview'
import { ResultsSection } from './components/Results/ResultsSection'
import { ToastStack } from './components/ui/ToastStack'
import { LoginPage } from './components/Auth/LoginPage'
import { SubscribeModal } from './components/Auth/SubscribeModal'
import { AdminPanel } from './components/Auth/AdminPanel'
import { useStudio } from './store/StudioContext'
import { useAuth } from './auth/AuthContext'

function ThemeBoot() {
  const { state } = useStudio()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])
  return null
}

function StudioApp() {
  const { isLoggedIn } = useAuth()
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  if (!isLoggedIn) {
    return (
      <>
        <ThemeBoot />
        <LoginPage />
        <ToastStack />
      </>
    )
  }

  return (
    <div className="min-h-svh pb-10">
      <ThemeBoot />
      <Header
        onOpenSubscribe={() => setSubscribeOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
      />
      <UploadZone onNeedSubscribe={() => setSubscribeOpen(true)} />

      <section className="mx-auto mt-6 grid max-w-[1400px] gap-4 px-4 lg:grid-cols-2 lg:items-stretch sm:px-6">
        <CropSettings />
        <LivePreview />
      </section>

      <ResultsSection />
      <ToastStack />

      <SubscribeModal open={subscribeOpen} onClose={() => setSubscribeOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />

      <footer className="mx-auto mt-4 max-w-[1400px] px-4 text-center text-xs text-muted sm:px-6">
        Face Crop Studio · Privacy-first batch cropping · Images stay in your browser
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <>
      <StudioApp />
      <SpeedInsights />
    </>
  )
}
