import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Dashboard from './Dashboard'
import DashboardErrorBoundary from './components/DashboardErrorBoundary'
import './dashboard.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DashboardErrorBoundary>
      <Dashboard />
    </DashboardErrorBoundary>
  </StrictMode>,
)
