import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { StudioProvider } from './store/StudioContext'
import { AuthProvider } from './auth/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <StudioProvider>
        <App />
      </StudioProvider>
    </AuthProvider>
  </StrictMode>,
)
