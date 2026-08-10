import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import AboutPage from './mvp/AboutPage'
import AppShell, { type RouteName } from './mvp/AppShell'
import HistoryPage from './mvp/HistoryPage'
import ScanPage from './mvp/ScanPage'
import TodayPage from './mvp/TodayPage'
import { createInitialScanSession } from '../domain/scanSession'
import type { LogEntry } from '../domain/types'
import { deleteAnalysis } from '../lib/api'
import './mvp/sugar-pai.css'

const ROUTES: RouteName[] = ['scan', 'today', 'history', 'about']
const BASE = 'sugar-pai'

function routeFromHash(): RouteName {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path === BASE || path === `${BASE}/`) return 'scan'
  const [, route] = path.split('/')
  return ROUTES.includes(route as RouteName) ? route as RouteName : 'scan'
}

function normalizeSugarPaiHash() {
  const path = window.location.hash.replace(/^#\/?/, '')
  if (path === BASE || path === `${BASE}/`) {
    window.history.replaceState(null, '', `#/${BASE}/scan`)
  }
}

interface Props {
  triggerToast?: (message: string, type?: string) => void
  onLogMeal?: (entry: LogEntry) => void
}

export default function SugarPAIApp({ triggerToast, onLogMeal }: Props) {
  const [route, setRoute] = useState<RouteName>(routeFromHash)
  const [toast, setToast] = useState<string | null>(null)
  const [scanSession, setScanSession] = useState(createInitialScanSession)

  useEffect(() => {
    normalizeSugarPaiHash()
    const onHashChange = () => {
      normalizeSugarPaiHash()
      setRoute(routeFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const analysisId = scanSession.analysisId
    if (!analysisId) return
    const onPageHide = () => {
      void deleteAnalysis(analysisId).catch(() => undefined)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [scanSession.analysisId])

  const navigate = (next: RouteName) => {
    window.location.hash = `#/${BASE}/${next}`
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logged = async (entry: LogEntry) => {
    if (scanSession.analysisId) await deleteAnalysis(scanSession.analysisId).catch(() => undefined)
    setScanSession(createInitialScanSession())
    onLogMeal?.(entry)
    const message = 'Confirmed label values saved on this device.'
    setToast(message)
    triggerToast?.(message, 'success')
    window.setTimeout(() => setToast(null), 4200)
    navigate('today')
  }

  return (
    <div className="sugar-pai-embed">
      <AppShell route={route} navigate={navigate}>
        {toast && <div className="toast"><CheckCircle2 size={18} /> {toast}</div>}
        {route === 'scan' && <ScanPage session={scanSession} setSession={setScanSession} onLogged={logged} />}
        {route === 'today' && <TodayPage onScan={() => navigate('scan')} />}
        {route === 'history' && <HistoryPage onScan={() => navigate('scan')} />}
        {route === 'about' && <AboutPage />}
      </AppShell>
    </div>
  )
}
